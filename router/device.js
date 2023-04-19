const express = require("express");
const { ObjectId } = require("mongodb");
const { riverPointCollection, measurementCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken')

const router = express.Router();

router.get('/', authenticateToken, function (req, res) {
    let points = []

    riverPointCollection()
        .find({device: true})
        .forEach(point => {
            point.lng = point.loc.coordinates[0]
            point.lat = point.loc.coordinates[1]
            delete point.loc; 

            points.push(point)
        })
        .then(() => {
            res.status(200).json(points);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.post('/:pointId', authenticateToken, function (req, res) {

    const pointId = req.params.pointId;

    riverPointCollection()
        .updateOne(
            {
                _id: new ObjectId(pointId)
            },
            {
                $set: {device: true}
            }
        )
        .then((dbRes) => {
            if (dbRes.matchedCount == 0){
                res.status(500).json({error: "Couldn't find a match!"});
            }
            else {
                res.status(201).json();
            }
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.post('/', authenticateToken, function (req, res) {

    if (req.body.lat === undefined || req.body.lng === undefined){
        res.status(400).json({error: "lat and lng fields are required!"});
        return;
    }

    riverPointCollection()
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
          .then((points) => {
            const closestPoint = points[0];
            riverPointCollection()
                .updateOne(
                    {
                        _id: new ObjectId(closestPoint._id)
                    },
                    {
                        $set: {device: true}
                    }
                )
                .then((dbRes) => {
                    if (dbRes.matchedCount == 0){
                        res.status(500).json({error: "Couldn't find a match!"});
                    }
                    else {
                        res.status(201).json();
                    }
                })
                .catch(() => {
                    res.status(500).json({error: "Couldn't fetch the records!"});
                })
          })
});

router.delete('/', authenticateToken, function (req, res) {

    if (req.body.lat === undefined || req.body.lng === undefined){
        res.status(400).json({error: "lat and lng fields are required!"});
        return;
    }

    riverPointCollection()
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
            .then((points) => {
                const closestPoint = points[0];
                riverPointCollection()
                    .updateOne(
                        {
                            _id: new ObjectId(closestPoint._id)
                        },
                        {
                            $set: {device: false}
                        }
                    )
                    .then((dbRes) => {
                        if (dbRes.matchedCount == 0){
                            res.status(500).json({error: "Couldn't find a match!"});
                        }
                        else {
                            res.status(200).json();
                        }
                    })
                    .catch(() => {
                        res.status(500).json({error: "Couldn't fetch the records!"});
                    })
            })

    
});


router.delete('/all', authenticateToken, function (req, res) {

    riverPointCollection()
        .update(
            {},
            {
                $set: {device: false}
            }
        )
        .then((dbRes) => {
            if (dbRes.matchedCount == 0){
                res.status(500).json({error: "Couldn't find a match!"});
            }
            else {
                res.status(200).json();
            }
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

module.exports = router;