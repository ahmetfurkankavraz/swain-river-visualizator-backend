const express = require("express");
const { measurementCollection, riverPointCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken')

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
function divideRiverBranchesToSegments(branch, min, max, branchId){
    const segmentDividerArray = arrayRange(min, max, 5);
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

router.get('/:date/:type', authenticateToken, function (req, res) {
    
    const date = new Date(req.params.date);
    const type = req.params.type;
    const scale = 5

    // get the devices with specific type and date 
    let deviceLocations = [];
    let measurementsMap = new Map();
    let min = Infinity;
    let max = -Infinity;
    measurementCollection()
        .find({date})
        .forEach(measurement => {
            measurement.date = measurement.date.toISOString().split('T')[0]
            if (measurement.type == type){
                deviceLocations.push(measurement.pointId)
                if (!measurementsMap[measurement.pointId]){
                    measurementsMap[measurement.pointId] = new Map();
                }
                measurementsMap[measurement.pointId][measurement.type] = measurement;
                min = Math.min(min, measurement.value);
                max = Math.max(max, measurement.value);
            } else {
                measurementsMap[measurement.pointId][measurement.type] = measurement;
            }
            
        })
        .then(() => {
            
        // using the devices find the unique branches
        riverPointCollection()
            .distinct("branchId", {_id: {$in: deviceLocations}})
            .then((clippedBranches) => {

                // extract the map for only selected branches
                let pointMap = new Map();
                let measurementsByBranches = new Map();
                riverPointCollection()
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
                    })
                    .then(() => {

                        // riverPointCollection()
                        // .aggregate([
                        //     {"$match": {
                        //         "branchId": {$in: clippedBranches}
                        //     }},
                        //     { "$group": {
                        //         "_id": {
                        //             "lat": "$lat",
                        //             "lng": "$lng"
                        //         },
                        //         "count": { "$sum": 1 }
                        //     }},
                        //     {"$match": {
                        //         "count": {$gt: 1}
                        //     }}
                        // ])
                        // .toArray()
                        // .then(crossingPoints => {
                        //     riverPointCollection()
                        //         .find({device: true, branchId: {$in: clippedBranches}})
                        //         .toArray()
                        //         .then(devices => {
                        //             console.log(devices, crossingPoints);
                        //         })
                        // })

                        let river = []
                        
                        for (let key in pointMap){

                            if (min === max){
                                river.push({
                                    scale: 0,
                                    branchId: key,
                                    segmentInd: 0,
                                    riverPoints: pointMap[key]
                                });
                                continue;
                            }

                            arrangeMeasurementsArray(measurementsByBranches[key], pointMap[key].at(-1).orderInBranch);
                            let iterator = 1;

                            for (let point in pointMap[key]){
                                if (iterator + 1 < measurementsByBranches[key].length && pointMap[key][point].orderInBranch > measurementsByBranches[key][iterator].orderInBranch){
                                    iterator++;
                                }
                                let order = pointMap[key][point].orderInBranch; 
                                
                                // pointMap[key][point].value = myInterpolationFunction(
                                //                                 order, 
                                //                                 measurementsByBranches[key][iterator - 1], 
                                //                                 measurementsByBranches[key][iterator]);
                                let measurements = [measurementsByBranches[key][iterator - 1], measurementsByBranches[key][iterator]];
                                calcInterpolationValue(pointMap[key][point], measurements, measurementsMap);
                                // measurementsByBranches[key][iterator].value;
                            }
                            river = river.concat(divideRiverBranchesToSegments(pointMap[key], min, max, key));
                        }
                        res.status(200).json(river);
                    })
            })
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

module.exports = router;