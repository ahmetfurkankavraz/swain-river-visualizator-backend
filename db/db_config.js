module.exports = {
    collectionsConfig: [
        {
            name: 'river-points',
            validator: {
                $jsonSchema: {
                    bsonType: "object",
                    required: [ "loc", "branchId", "orderInBranch", "device"],
                    properties: {
                        loc: {
                            bsonType: "object",
                            required: [ "type", "coordinates"],
                            description: "location of the river point - Required",
                            properties: {
                                type: {
                                    bsonType: "string",
                                    description: "type of the river location - Required"
                                },
                                coordinates: {
                                    bsonType: "array",
                                    description: "longitude and latitude of the river location - Required"
                                }
                            }
                        },
                        // lat: {
                        //     bsonType: "double",
                        //     description: "lat of the river point - Required"
                        // },
                        // lng: {
                        //     bsonType: "double",
                        //     description: "lng of the river point - Required"
                        // },
                        branchId: {
                            bsonType: "int",
                            description: "branchId of the river point - Required"
                        },
                        orderInBranch: {
                            bsonType: "int",
                            description: "orderInBranch of the river point - Required"
                        },
                        device: {
                            bsonType: "bool",
                            description: "device of the river point - Required"
                        }
                    }
                }
            }
        },
        {
            name: 'measurement',
            validator: {
                $jsonSchema: {
                    bsonType: "object",
                    required: [ "pointId", "date", "type", "value"],
                    properties: {
                        pointId: {
                            bsonType: "objectId",
                            description: "objectId of the river point - Required"
                        },
                        date: {
                            bsonType: "date",
                            description: "date of measurement - Required"
                        },
                        type: {
                            bsonType: "string",
                            description: "type of measurement - Required"
                        },
                        unit: {
                            bsonType: "string",
                            description: "unit of measurement - Optinal"
                        },
                        value: {
                            bsonType: "double",
                            description: "value of measurement - Required"
                        }
                    }
                }
            }
        },
        {
            name: 'admins'
        }
    ]
}