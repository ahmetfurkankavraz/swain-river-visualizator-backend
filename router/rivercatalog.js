const express = require("express");
const { riverPointCollection, catalogCollection } = require("../db/db");
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');


async function createCatalog(rootBranchId) {

  try {
  
      let rs = await riverPointCollection().aggregate([
          // Group by branchId and find minimum and maximum orderInBranch for each group
          {
            $group: {
              _id: "$branchId",
              minOrder: { $min: "$orderInBranch" },
              maxOrder: { $max: "$orderInBranch" },
              items: { $push: "$$ROOT" } // Add all the documents to the 'items' array
            }
          },
          // Project only the documents that have minimum or maximum orderInBranch
          {
            $project: {
              _id: 0,
              branchId: "$_id",
              items: {
                $filter: {
                  input: "$items",
                  as: "item",
                  cond: {
                    $or: [
                      { $eq: ["$$item.orderInBranch", "$minOrder"] },
                      { $eq: ["$$item.orderInBranch", "$maxOrder"] }
                    ]
                  }
                }
              }
            }
          }
        ]).toArray();


      const adjacencyList = new Map();
      const pathlist = []
      const adjlist = new Map();

      // Create an array to store the promises
      const promises = [];
          
      const mappedPoints = []
      // Use for...of loop to iterate over rs array
      for (const el of rs) {
      // Use for...of loop to iterate over items array
      for (const item of el.items) {
          // Push the promise into the array
          let rs = riverPointCollection().aggregate([{
          $geoNear: {
              near: item.loc,
              distanceField: "distance",
              spherical: true
          }
          },{
          $match: {
              branchId: { $ne: el.branchId }
          }
          },{
          $sort: {
              distance: 1
          }
          },{
          $limit: 1
          }]).toArray().then(a => {

              a.forEach((point) => {
                  if (point.distance <= 75){
                      let f = {
                          "lng": item.loc.coordinates[0],
                          "lat": item.loc.coordinates[1]
                      } 
                      let x = {
                          "lng": point.loc.coordinates[0],
                          "lat": point.loc.coordinates[1]
                      }
                      pathlist.push([f, x]);   
                      mappedPoints.push([point._id, item._id]);
                      mappedPoints.push([item._id, point._id]);
                  }
              })

              if (adjlist.has(el.branchId)){
                  let old = adjlist.get(el.branchId);
                  a.forEach((point) => { 
                      old.add(point.branchId);
                  });
              }
              else {
                  adjlist.set(el.branchId, new Set(a.map((point) => point.branchId)));
              }

              a.forEach((point) => {
                  if (!adjlist.has(point.branchId)){
                      adjlist.set(point.branchId, new Set([el.branchId]));
                  }
                  else {
                      let old = adjlist.get(point.branchId);
                      old.add(el.branchId);
                  }
              });
          });
          promises.push(rs);
      }}
      
      await Promise.all(promises);

      let result = []
      // print the adjacency list
      for (let [key, value] of adjacencyList) {
          result.push(value.path)
      }

      // for (let [key, value] of adjlist){
      //     console.log(key, value);
      // }

      let topologicalSort = [];
      function dfs(adjlist, node, visited){

          visited.add(node);
      
          for (let next of adjlist.get(node)){
              if (!visited.has(next)){
                  dfs(adjlist, next, visited);
              }
          }

          topologicalSort.push(node);
      }

      let visited = new Set();
      dfs(adjlist, rootBranchId, visited);

      // console.log(topologicalSort.reverse());
      // console.log(mappedPoints);

      const catalog = {
          rootBranch: rootBranchId,
          topologicalSort,
          mappedPoints
      }

      // console.log(catalog);

      await catalogCollection().deleteMany({})
      await catalogCollection().insertOne(catalog);

  } catch (error) {
    console.log("An error occured while creating catalog!");
  }
}

// generate database catalog
router.get('/', authenticateToken, async function (req, res) {

  try {
  
      await createCatalog();

      res.status(200).send();
  
  } catch (error) {
      console.log(error);
      res.status(500).json({error: "An error occurred during the interpolation"});
  }
});

module.exports = {createCatalog, router};