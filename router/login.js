const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const { adminsCollection } = require('../db/db');
const crypto = require('crypto');

function sha256(input) {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex');
}

router.post('/', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    adminsCollection()
        .findOne({username: username, password: sha256(password)})
        .then((admin) => {
            if (admin){
                const user = { name: username };
                const accessToken = jwt.sign(
                    user, 
                    process.env.ACCESS_TOKEN_SECRET, 
                    {expiresIn: '2h'}
                );
                res.status(200).json({ accessToken: accessToken });
            } else {
                res.sendStatus(401);
            }
        })
        .catch((err) => {
            console.log(err);
            res.sendStatus(500);
        })
});

module.exports = router;