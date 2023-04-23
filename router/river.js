const express = require("express");
const { riverPointCollection, measurementCollection } = require('../db/db');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.get('/', authenticateToken, function (req, res) {
    
    let pointMap = new Map();

    riverPointCollection()
        .find()
        .sort({branchId: 1, orderInBranch: 1})
        .forEach(point => {
            point.lng = point.loc.coordinates[0]
            point.lat = point.loc.coordinates[1]
            delete point.loc; 

            if (!pointMap[point.branchId]){
                pointMap[point.branchId] = [point];
            } 
            else {
                pointMap[point.branchId].push(point);
            }
        })
        .then(() => {
            let river = []
            for (let key in pointMap){
                let riverBranch = {
                    branchId: key,
                    riverPoints: pointMap[key]
                }
                river.push(riverBranch)
            }
            res.status(200).json(river);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.post('/', authenticateToken, function (req, res) {

    const riverPointsInDb = []

    const river = req.body;
    let branchIndex = 0;
    river.sort((a, b) => b.length - a.length);

    river.forEach((branch) => {

        let orderInBranch = 0;
        
        branch.forEach((riverPoint) => {
            
            if (riverPoint.lat === undefined || riverPoint.lng === undefined){
                res.status(400).json({error: "Input is not valid!"});
                return;
            }

            riverPointsInDb.push({
                loc: {type: "Point", coordinates: [riverPoint.lng, riverPoint.lat]},
                branchId: branchIndex, 
                orderInBranch: orderInBranch,
                device: false
            })
            orderInBranch++;
        });
        branchIndex++;
    })

    riverPointCollection()
        .insertMany(riverPointsInDb)
        .then(() => {
            res.status(201).send();
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't insert the records!"})
        })
});

router.delete('/', authenticateToken, function (req, res) {
    riverPointCollection()
        .deleteMany({})
        .then(() => {
            measurementCollection()
                .deleteMany({})
                .then(() => {
                    res.status(200).send();
                })
                .catch(() => {
                    res.status(500).json({error: "Couldn't delete the records!"})
                })
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't delete the records!"})
        })
});

module.exports = router;