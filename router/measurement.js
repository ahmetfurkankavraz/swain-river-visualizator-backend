const express = require("express");
const { ObjectId, Double } = require("mongodb");
const { riverPointCollection, measurementCollection } = require('./../db/db')
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.get('/', authenticateToken, function (req, res) {
    let measurements = []

    measurementCollection()
        .find()
        .forEach(measurement => {
            measurement.date = measurement.date.toISOString().split('T')[0]
            measurements.push(measurement)
        })
        .then(() => {
            res.status(200).json(measurements);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/date', authenticateToken, function (req, res) {
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

router.get('/:date/type', authenticateToken, function (req, res) {
    
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

router.get('/:date/:type', authenticateToken, function (req, res) {
    let measurements = []

    const type = req.params.type;
    const date = new Date(req.params.date);
    if (date.toString() === "Invalid Date"){
        res.status(400).json({error: "Date should be valid!"});
        return;
    }

    measurementCollection()
        .find({date: date, type: type})
        .forEach(measurement => {
            measurement.date = measurement.date.toISOString().split('T')[0]
            measurements.push(measurement)
        })
        .then(() => {
            res.status(200).json(measurements);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
});

router.get('/:deviceId', authenticateToken, function (req, res) {
    let measurements = []

    const deviceId = req.params.deviceId;

    measurementCollection()
        .find({pointId: new ObjectId(deviceId)})
        .forEach(measurement => {
            measurement.date = measurement.date.toISOString().split('T')[0]
            measurements.push(measurement)
        })
        .then(() => {
            res.status(200).json(measurements);
        })
        .catch(() => {
            res.status(500).json({error: "Couldn't fetch the records!"});
        })
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

router.post('/', authenticateToken, function (req, res) {
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