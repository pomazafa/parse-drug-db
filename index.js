const https = require("https");
const parseString = require("xml2js").parseString;
const jp = require("jsonpath");
const fetch = require("node-fetch");
// fs = require("fs");

const { Pool, Client } = require("pg");

const pool = new Pool({
  user: "pgAdmin",
  host: "oncoassist-db.c86eqtmastcm.us-east-2.rds.amazonaws.com",
  database: "maindatabase",
  password: "passwordA1",
  port: "5432",
});

async function load() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let drugsUrl =
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?doctype=34391-3";
    //   "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?doctype=34391-3&page=425&pagesize=100";
    while (drugsUrl != "null") {
      let response = await fetch(drugsUrl);
      const result = await response.json();

      const insertDrugText = `INSERT INTO 
      "Lookup_Drug_List"(
          "sDrugID", 
          "sDrug",
          "dDateTime", 
          "dModifiedDate") 
      VALUES (
        $1, 
        $2, 
        current_timestamp, 
        current_timestamp)
      ON CONFLICT DO NOTHING;`;

      result.data.forEach((drug) => {
        const insertDrugValues = [drug.setid, drug.title];
        client.query(insertDrugText, insertDrugValues);
        drugInfo(drug.setid, client);
      });
      drugsUrl = result.metadata.next_page_url;
    }
    await client.query("COMMIT");
    console.log("COMMIT !!!!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.log("ROLLBACK");
    console.log(e);
    // throw e;
    exit(0);
  }
}

function drugInfo(setid, client) {
  const insertActiveIngredientText = `INSERT INTO 
            "Lookup_Active_Ingredient"(
                "sActiveIngredient", 
                "dDateTime", 
                "dModifiedDate") 
            VALUES (
                $1, 
                current_timestamp, 
                current_timestamp)
            ON CONFLICT DO NOTHING;`;
  const insertDrugIngredientText = `INSERT INTO 
            "Lookup_Drug_Ingredients"(
                "sDrugID", 
                "sIngredientID",
                "dDateTime", 
                "dModifiedDate") 
            VALUES (
                $1, 
                (SELECT "sRowID" from "Lookup_Active_Ingredient" where "sActiveIngredient" = $2 limit 1), 
                current_timestamp, 
                current_timestamp)
            ON CONFLICT DO NOTHING;`;
  const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setid}.xml`;
  https
    .get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        parseString(data, function (err, result) {
          var nodes = jp.query(result, `$..activeMoiety`);
          for (var i = 0; i < nodes.length; i++) {
            nodes[i].forEach((entry) => {
              if (entry.code) {
                const insertActiveIngredientValues = [entry.name[0]];
                client.query(
                  insertActiveIngredientText,
                  insertActiveIngredientValues
                );
                const insertDrugIngredientValues = [setid, entry.name[0]];
                client.query(
                  insertDrugIngredientText,
                  insertDrugIngredientValues
                );
                console.log(entry.code[0].$.code, entry.name[0]);
              }
            });
          }
        });
      });
    })
    .on("error", (err) => {
      console.log(err.message);
    });
}

load();
// const url =
//   "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/1e0ae43a-037f-42af-8e23-a0e51d75abe8.xml";

// https
//   .get(url, (res) => {
//     let data = "";
//     res.on("data", (chunk) => {
//       data += chunk;
//     });
//     res.on("end", () => {
//       //   console.log(data);
//       fs.writeFile("test.xml", data, function (err) {
//         if (err) return console.log(err);
//       });
//       parseString(data, function (err, result) {
//         var nodes = jp.query(result, `$..activeMoiety`);
//         for (var i = 0; i < nodes.length; i++) {
//           nodes[i].forEach((entry) => {
//             if (entry.code) {
//               console.log(entry.code[0].$.code, entry.name[0]);
//             }
//           });
//         }
//         // result.document.component[0].structuredBody[0].component[0].section[0].subject[0].manufacturedProduct[0].manufacturedProduct[0].ingredient.forEach(
//         //   (ingredient) => {
//         //     ingredient.ingredientSubstance.forEach((substance) => {
//         //         substance.activeMoiety? console.log(substance.activeMoiety[0].activeMoiety)
//         //     });
//         //   }
//         // );
//       });
//     });
//   })
//   .on("error", (err) => {
//     console.log(err.message);
//   });
