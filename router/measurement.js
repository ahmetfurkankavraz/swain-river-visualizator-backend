const express = require("express");
const { ObjectId, Double } = require("mongodb");
const { riverPointCollection, measurementCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.get('/', authenticateToken, async function (req, res) {
    try {
        const measurements = [];
        const measurementCursor = await measurementCollection().find();
      
        for await (const measurement of measurementCursor) {
          measurement.date = measurement.date.toISOString().split('T')[0];
          const point = await riverPointCollection().findOne({ _id: new ObjectId(measurement.pointId) });
          measurement.lng = point.loc.coordinates[0];
          measurement.lat = point.loc.coordinates[1];
          measurements.push(measurement);
        }
      
        res.status(200).json(measurements);
    } catch (error) {
        res.status(500).json({ error: "Couldn't fetch the records!" });
    }
      
});

router.get('/date', authenticateToken, async function (req, res) {
    measurementCollection()
        .distinct("date", {})
        .then((dates) => {
            dates = dates.map(date => date.toISOString().split('T')[[0]])
            res.status(200).json(dates);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/:date/type', authenticateToken, async function (req, res) {
    
    const date = new Date(req.params.date);
    measurementCollection()
        .distinct("type", {date: date})
        .then((types) => {
            res.status(200).json(types);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/type', authenticateToken, async function (req, res) {
    measurementCollection()
        .distinct("type", {})
        .then((types) => {
            res.status(200).json(types);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/:type/date', authenticateToken, async function (req, res) {
    
    const type = req.params.type;
    measurementCollection()
        .distinct("date", {type})
        .then((dates) => {
            dates = dates.map(date => date.toISOString().split('T')[[0]])
            res.status(200).json(dates);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/:date/:type', authenticateToken, async function (req, res) {
    const type = req.params.type;
    const date = new Date(req.params.date);
    if (date.toString() === "Invalid Date"){
        res.status(400).json({error: "Date should be valid!"});
        return;
    }

    try {
        const measurements = [];
        const measurementCursor = await measurementCollection().find({ date: date, type: type });
      
        for await (const measurement of measurementCursor) {
          measurement.date = measurement.date.toISOString().split('T')[0];
          
          const point = await riverPointCollection().findOne({ _id: new ObjectId(measurement.pointId) });
          measurement.lng = point.loc.coordinates[0];
          measurement.lat = point.loc.coordinates[1];
          
          measurements.push(measurement);
        }
      
        res.status(200).json(measurements);
      } catch (error) {
        res.status(500).json({ error: "Couldn't fetch the records!" });
      }
      
});

router.get('/:deviceId', authenticateToken, async function (req, res) {
    try {
        const measurements = [];
        const deviceId = req.params.deviceId;
        const measurementCursor = await measurementCollection().find({ pointId: new ObjectId(deviceId) });
      
        for await (const measurement of measurementCursor) {
          measurement.date = measurement.date.toISOString().split('T')[0];
          const point = await riverPointCollection().findOne({ _id: new ObjectId(measurement.pointId) });
          measurement.lng = point.loc.coordinates[0];
          measurement.lat = point.loc.coordinates[1];
          measurements.push(measurement);
        }
      
        res.status(200).json(measurements);
    } catch (error) {
        res.status(500).json({ error: "Couldn't fetch the records!" });
    }
});

router.delete('/:measurementId', authenticateToken, function (req, res) {
    let points = []

    const measurementId = req.params.measurementId;

    measurementCollection()
        .deleteOne({_id: new ObjectId(measurementId)})
        .then(() => {
            res.status(200).json(points);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});


router.get('/catalog/:date/:type', authenticateToken, async function (req, res) {
    
    try {
        const type = req.params.type;
        const date = new Date(req.params.date);
        if (date.toString() === "Invalid Date"){
            res.status(400).json({error: "Date should be valid!"});
            return;
        }

        let min = Infinity;
        let max = -Infinity;
        await measurementCollection()
            .find({ date: date, type: type })
            .forEach((measurement) => {
                min = Math.min(min, measurement.value);
                max = Math.max(max, measurement.value);
            });

        res.status(200).json({"min-value": min, "max-value": max});

    } catch (error) {
        res.status(500).json({ error: "Couldn't fetch the records!" });
    }
});


router.post('/', authenticateToken, async function (req, res) {
    const measurement = req.body;
    
    if (measurement.pointId === undefined || measurement.date === undefined || measurement.type === undefined || measurement.value === undefined){
        res.status(400).json({error: "Input should have pointId, date, type and value fields!"});
        return;
    }
    const date = new Date(measurement.date);
    if (date.toString() === "Invalid Date"){
        res.status(400).json({error: "Date should be valid!"});
        return;
    }

    // Aynı verilerden varsa burada update işlemi gerçekleşmeli
    // şu an her case'de sadece yeni değer create ediliyor.

    measurementCollection()
        .findOne({pointId: new ObjectId(measurement.pointId), date: new Date(measurement.date), type: measurement.type})
        .then((existRecord) => {
            if (existRecord == null){
                riverPointCollection()
                    .findOne({_id: new ObjectId(measurement.pointId)})
                    .then((dbRes) => {
                        if (dbRes && dbRes.device){
                            measurement.pointId = new ObjectId(measurement.pointId);
                            measurement.date = date;
                            measurement.value = new Double(measurement.value);
                            measurementCollection()
                                .insertOne(measurement)
                                .then(() => {
                                    res.status(201).send();
                                })
                                .catch((err) => {
                                    console.log(err);
                                    res.status(500).json({error: "Couldn't insert the records!"})
                                })
                        } 
                        else if (dbRes && !dbRes.pointId){
                            res.status(400).json({error: "Couldn't find a device on the point!"})
                        }
                        else {
                            res.status(400).json({error: "Couldn't find a point on the river!"});
                        }
                    })
            } else {
                measurementCollection()
                    .updateOne({pointId: new ObjectId(measurement.pointId), date: new Date(measurement.date), type: measurement.type},
                        {$set: {value: new Double(measurement.value)}})
                        .then(() => {
                            res.status(200).send();
                        })
                        .catch((err) => {
                            console.log(err);
                            res.status(500).json({error: "Couldn't update the records!"})
                        })
            }
        })    
});

module.exports = router;