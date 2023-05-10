const express = require("express");
const { measurementCollection, riverPointCollection, catalogCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();


function arrayRange(min, max, step){
    let arr = []
    for (let i = min; i <= max; i += (max - min) / step){
        arr.push(i);
    }
    return arr;
}

function myInterpolationFunction(orderInBranch, measurement1, measurement2){
    return ((orderInBranch - measurement1.orderInBranch) * measurement2.value + 
    (measurement2.orderInBranch - orderInBranch) * measurement1.value) / 
    (measurement2.orderInBranch - measurement1.orderInBranch);
}

// Calculate the interpolation values for each point
// measurementPoints have the values of the coordinates and also the measurement of the specific type
// measurementBags have the values of all measurements, if you want to reach them
// you can use measurementBags[point_id][measurement_type]
// be careful that the searched measurement may not exist in the measurementBags for a device location
function calcInterpolationValue(point, devices, measurementBags){
    point.value = myInterpolationFunction(point.orderInBranch,
        devices.at(0), devices.at(1));
}


function findScale(point, segmentDividerArray){
    let ind = 0;
    while ( ind < segmentDividerArray.length - 1 && !(point.value >= segmentDividerArray[ind] && point.value <= segmentDividerArray[ind + 1])){
        ind++;
    }
    return ind;
}

// Divide the river branches to segments according to their interpolated values
// for scale, min and max values are used to segment the points 
// this function provides a faster rendering for the frontend
function divideRiverBranchesToSegments(branch, segmentDividerArray, branchId){
    let prevScale = findScale(branch[0], segmentDividerArray);
    let segmentInd = 0;
    let separateSegments = [{scale: prevScale, branchId, segmentInd, riverPoints: [branch[0]]}]; 

    for (let ind in branch){
        let scale = findScale(branch[ind], segmentDividerArray);
        if (prevScale === scale){
            separateSegments.at(-1).riverPoints.push(branch[ind]);
        } else {
            separateSegments.at(-1).riverPoints.push(branch[ind]);
            segmentInd++;
            separateSegments.push({scale, branchId, segmentInd, riverPoints: [branch[ind]]});
        }
        prevScale = scale;
    }
    return separateSegments;
}

// Before the interpolation append an element for orderInBranch = 0 and orderInBranch = last_item
function arrangeMeasurementsArray(measurementsArray, lastItemOrderInBranch){
    measurementsArray.sort((a, b) => a.orderInBranch - b.orderInBranch);
    measurementsArray.unshift({ ...measurementsArray.at(0) });
    measurementsArray.push({ ...measurementsArray.at(-1) });
    measurementsArray.at(0).orderInBranch = 0;
    measurementsArray.at(-1).orderInBranch = lastItemOrderInBranch;
}

function validateScaleArray(arr){

    if (!arr){
        return false;
    }

    if (arr.length < 2){
        return false;
    }

    for (let i = 0; i < arr.length; i++){
        arr[i] = parseFloat(arr[i]);
        if (isNaN(arr[i])){
            return false;
        }
    }

    for (let i = 0; i < arr.length - 1; i++){
        if (arr[i] > arr[i + 1]){
            return false;
        }
    }
    return true;
}

router.get('/:date/:type', authenticateToken, async function (req, res) {

try {

    // create the segment divider array in here.
    // to do that, the min and max values should be guaranteed by user input.
    // if found values by us is not proper that throw an error for that case
    // but this is general case.
    
    // for frontend application we need to check it in the frontend
    // and if it is not proper, we will not send the request to the backend
    
    // now we need an endpoint to retrieve the min and max values for a specific type
    // then, we will change the interpolation parameters where user can send an array
    // for the segment divider array


    const date = new Date(req.params.date);
    const type = req.params.type;
    const segmentDividerArray = req.query.scaleArray;

    if (!validateScaleArray(segmentDividerArray)){
        res.status(400).send({error: "Scale array is not valid"});
        return;
    }
    
    // get the devices with specific type and date 
    let deviceLocations = [];
    let measurementsMap = new Map();
    let min = Infinity;
    let max = -Infinity;
    
    // get all the measurements for the specific date and type
    // hold them in the measurementsMap
    await measurementCollection()
        .find({date})
        .forEach(measurement => {
            measurement.date = measurement.date.toISOString().split('T')[0]
            if (measurement.type === type){
                deviceLocations.push(measurement.pointId)
                if (!measurementsMap[measurement.pointId]){
                    measurementsMap[measurement.pointId] = new Map();
                }
                measurementsMap[measurement.pointId][measurement.type] = measurement;
                min = Math.min(min, measurement.value);
                max = Math.max(max, measurement.value);
            } else {
                if (!measurementsMap[measurement.pointId]){
                    measurementsMap[measurement.pointId] = new Map();
                }
                measurementsMap[measurement.pointId][measurement.type] = measurement;
            }
        });

    // if we map the points somehow, we can also map the measurements by looking that map table
    // the mapping part can be embedded here.
    // a point table should be used to map the close points in river
    // format is {from: pointID, to: pointID}
    // then if there is a measurement for a "from point", we can also map the measurement for the "to point"
    
    
    // using the measurements find the unique branches
    let clippedBranches = await riverPointCollection()
        .distinct("branchId", {_id: {$in: deviceLocations}});
        
    // extract the map with only using selected branches
    let pointMap = new Map();
    let measurementsByBranches = new Map();
    await riverPointCollection()
        .find({branchId: {$in: clippedBranches}})
        .sort({branchId: 1, orderInBranch: 1})
        .forEach(point => {
            point.lng = point.loc.coordinates[0]
            point.lat = point.loc.coordinates[1]
            delete point.loc; 

            // check whether there is a measurement in the point or not
            // if yes, store the measurement for a specific branch measurements
            if (measurementsMap[point._id] && measurementsMap[point._id][type]){
                measurementsMap[point._id][type].orderInBranch = point.orderInBranch;
                if (!measurementsByBranches[point.branchId]){ 
                    measurementsByBranches[point.branchId] = [measurementsMap[point._id][type]]
                } 
                else {
                    measurementsByBranches[point.branchId].push(measurementsMap[point._id][type])
                }
            }
            if (!pointMap[point.branchId]){
                pointMap[point.branchId] = [point];
            } 
            else {
                pointMap[point.branchId].push(point);
            }
        });


    const riverCatalog = await catalogCollection()
        .findOne({})

    // topological sort array
    const topologicalSortArr = riverCatalog.topologicalSort;

    // crossing points map
    const mappedCrossingPoints = new Map();
    for (const arr of riverCatalog.mappedPoints){
        mappedCrossingPoints.set(arr[0].toString(), arr[1].toString());
    }

    // the interpolation will be held in topological order
    const traverseBranchesInTopologicalOrder = topologicalSortArr.filter((branchId) => clippedBranches.includes(branchId));
    
    // hold previous interpolations in a map
    const holdAllInterpolationsById = new Map();

    let river = []

    for (let key of traverseBranchesInTopologicalOrder){  // burada branchlerin hepsini topologic sıraya göre gezmek 
                                // ayrıca her branch noktası için daha önceden başka bir branchte 
                                // yapılmış ölçüm olabilir mi diye bakmak gerekiyor

        let branch = pointMap[key];

        if (min === max){
            river.push({
                scale: 0,
                branchId: key,
                segmentInd: 0,
                riverPoints: branch
            });
            continue;
        }

        // check whether there is a crossing point or not
        // if there is one
        // append a measurement for that specific point
        for (let point of branch){
            if (holdAllInterpolationsById.has(mappedCrossingPoints.get(point._id.toString()))){
                let measuredPoint = holdAllInterpolationsById.get(mappedCrossingPoints.get(point._id.toString()));
                measurementsByBranches[key].push({
                    pointId: point._id,
                    date,
                    type,
                    value: measuredPoint.value,
                    orderInBranch: point.orderInBranch
                });
            }
        }

        // arrange the measurements array
        // add an element for orderInBranch = 0 and orderInBranch = last_item
        // to be able to interpolate the values
        // and handle the errors in below
        arrangeMeasurementsArray(measurementsByBranches[key], pointMap[key].at(-1).orderInBranch);
        
        
        let iterator = 1;
        // the iterator used to find the devices 
        // if a measurement point is between two devices, the iterator will be used to 
        // find the two devices
        for (let point of branch){
            if (iterator + 1 < measurementsByBranches[key].length && point.orderInBranch >= measurementsByBranches[key][iterator].orderInBranch){
                iterator++;
            }

            let measurements = [measurementsByBranches[key][iterator - 1], measurementsByBranches[key][iterator]];
            calcInterpolationValue(point, measurements, measurementsMap);

            if (mappedCrossingPoints.has(point._id.toString())){
                holdAllInterpolationsById.set(point._id.toString(), point);
            }
        }
        river = river.concat(divideRiverBranchesToSegments(branch, segmentDividerArray, key));
    }
    res.status(200).json(river);

} catch (error) {
    console.log(error);
    res.status(500).json({error: "An error occurred during the interpolation"});
}
});

module.exports = router;