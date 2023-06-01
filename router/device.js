const express = require("express");
const { ObjectId } = require("mongodb");
const { riverPointCollection, measurementCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken')

const router = express.Router();

router.get('/', authenticateToken, async function (req, res) {
    try {
        let points = []

        await riverPointCollection()
            .find({device: true})
            .forEach(point => {
                point.lng = point.loc.coordinates[0]
                point.lat = point.loc.coordinates[1]
                delete point.loc;
                
                points.push(point)
            })

        res.status(200).json(points);
    } catch (error) {
        res.status(500).json({ error: "Couldn't fetch the records!" });
    }

});

router.post('/:pointId', authenticateToken, async function (req, res) {

    try {
        const pointId = req.params.pointId;

        let dbRes = await riverPointCollection()
            .updateOne(
                {
                    _id: new ObjectId(pointId)
                },
                {
                    $set: {device: true}
                }
            )

        if (dbRes.matchedCount == 0){
            res.status(500).json({error: "Couldn't find a match!"});
        }
        else {
            res.status(201).json();
        }
    } catch (error) {
        res.status(500).json({error: "Couldn't fetch the records!"});
    }
});

router.delete('/:pointId', authenticateToken, async function (req, res) {

    try {
        const pointId = req.params.pointId;

        let dbRes = await riverPointCollection()
            .updateOne(
                {
                    _id: new ObjectId(pointId)
                },
                {
                    $set: {device: false}
                }
            )

        if (dbRes.matchedCount == 0){
            res.status(500).json({error: "Couldn't find a match!"});
        } else {
            res.status(200).json();
        }
    } catch (error) {
        res.status(500).json({error: "Couldn't fetch the records!"});
    }
});

router.post('/', authenticateToken, async function (req, res) {

    try {
        if (req.body.lat === undefined || req.body.lng === undefined){
            res.status(400).json({error: "lat and lng fields are required!"});
            return;
        }

        let points = await riverPointCollection()
            .find({
                loc: {
                $near: {
                    $geometry: {
                        type: "Point" ,
                        coordinates: [ req.body.lng , req.body.lat ]
                    }
                }
                }})
            .limit(1)
            .toArray()

        const closestPoint = points[0];
        let dbRes = await riverPointCollection()
            .updateOne(
                {
                    _id: new ObjectId(closestPoint._id)
                },
                {
                    $set: {device: true}
                }
            )
            
        if (dbRes.matchedCount == 0){
            res.status(500).json({error: "Couldn't find a match!"});
        }
        else {
            res.status(201).json();
        }
    } catch (error) {
        res.status(500).json({error: "Couldn't fetch the records!"});
    }
});

router.delete('/', authenticateToken, async function (req, res) {

    try {

        if (req.body.lat === undefined || req.body.lng === undefined){
            res.status(400).json({error: "lat and lng fields are required!"});
            return;
        }

        let points = await riverPointCollection()
            .find({
                loc: {
                    $near: {
                    $geometry: {
                        type: "Point" ,
                        coordinates: [ req.body.lng , req.body.lat ]
                    }
                    }
                }})
                .limit(1)
                .toArray()

        const closestPoint = points[0];
        let dbRes = await riverPointCollection()
            .updateOne(
                {
                    _id: new ObjectId(closestPoint._id)
                },
                {
                    $set: {device: false}
                }
            )

        await measurementCollection()
            .deleteMany({pointId: closestPoint._id})


        if (dbRes.matchedCount == 0){
            res.status(500).json({error: "Couldn't find a match!"});
        }
        else {
            res.status(200).json();
        }
    } catch (error) {
        res.status(500).json({error: "Couldn't fetch the records!"});
    }
});


router.delete('/all', authenticateToken, async function (req, res) {

    try {
        let dbRes = await riverPointCollection()
            .update(
                {},
                {
                    $set: {device: false}
                }
            )

        if (dbRes.matchedCount == 0){
            res.status(500).json({error: "Couldn't find a match!"});
        }
        else {

            await measurementCollection()
                .deleteMany({})
                
            res.status(200).json();
        }
    } catch (error) {
        res.status(500).json({error: "Couldn't fetch the records!"});
    }
});

module.exports = router;