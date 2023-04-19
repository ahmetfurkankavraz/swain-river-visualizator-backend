const { MongoClient } = require('mongodb');
const { collectionsConfig } = require('./db_config') 

let dbConnection;

module.exports = {
    connectToDb: (cb) => {
        MongoClient.connect(process.env.MONGODB_URI)
        .then((client) => {
            dbConnection = client.db();

                let collectionNames = []
                dbConnection.listCollections().toArray().then((cols) => {
                    collectionNames = cols.map(col => col.name);

                    for (const key in collectionsConfig){
                        const config = collectionsConfig[key];
                        if (!collectionNames.includes(config.name)){
                            dbConnection.createCollection(config.name, {
                                validator: config.validator
                            });
                            console.log(config.name, " collection is created!");
                        }
                    }
                });
                dbConnection.collection('river-points').createIndex( { loc : "2dsphere" } ) 
                dbConnection.collection('admins').deleteMany({})
                    .then(() => {
                        dbConnection.collection('admins').insertMany(
                            process.env.ADMIN_CREDENTIALS.split(',')
                            .map((item) => {return {username: item.split(':')[0], password: item.split(':')[1]}})
                        );
                    })
            return cb();
        })
        .then(() => {
            console.log("Successfully connected to database!")
        })
        .catch(err => {
            console.log(err);
            return cb(err);
        })
    },
    getDb: () => dbConnection,
    riverPointCollection: () => dbConnection && dbConnection.collection('river-points'),
    measurementCollection: () => dbConnection && dbConnection.collection('measurement'),
    adminsCollection: () => dbConnection && dbConnection.collection('admins'),
};