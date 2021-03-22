// const https = require("https");
const parseString = require("xml2js").parseString;
const jp = require("jsonpath");
const fetch = require("node-fetch");
// fs = require("fs");
var request = require("request");
const cheerio = require("cheerio");

const { Pool, Client } = require("pg");

async function processArray(array, drugUrl, client) {
  for (const drug of array) {
    const asd = await processAsyncFunction(drug, client).then((response) => {
      processDrugInfo(
        response.error,
        response.response,
        response.html,
        response.setid,
        client
      );
    });
  }
  // await client.query("COMMIT");
  // console.log(`process ${drugUrl}`);
}

async function processAsyncFunction(drug) {
  return await drugInfo(drug.setid); // await is actually optional here
  // you'd return a Promise either way.
}

async function processDrugInfo(error, response, html, setid, client) {
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
  if (!error && response.statusCode == 200) {
    var result = cheerio.load(html, {
      xmlMode: true,
    });

    try {
      const drugNameTrim = result(
        "subject manufacturedProduct manufacturedProduct name"
      )
        .get(0)
        .children[0].data.trim()
        .toLowerCase();
      const names = result(`activeMoiety name`);
      const nodes = names.map((index) => {
        return names.get(index).children[0].data.trim().toLowerCase();
      });

      selectIngredients = `select 
            lower("sActiveIngredient") as "sActiveIngredient", 
            DI."sDrugID" 
          from 
            "Lookup_Drug_List" as DL 
          inner join 
            "Lookup_Drug_Ingredients" as DI 
              on DI."sDrugID" = DL."sDrugID" 
          inner join 
            "Lookup_Active_Ingredient" as AI
              on AI."sRowID" = DI."sIngredientID"
          where 
            LOWER(DL."sDrug") = '${drugNameTrim}';`;
      const res = await client.query(selectIngredients);
      const resObj = new Set(res.rows.map((r) => r.sDrugID));
      const drugsIngredients = Array.from(resObj).map((drugId) => {
        return res.rows.filter((row) => {
          return row.sDrugID == drugId;
        });
      });

      drugsIngredients.forEach((drugIngredients) => {
        drugIngredients.isUnique = !compareSets(
          drugIngredients.map((d) => d.sActiveIngredient),
          nodes
        );
      });

      // if (drugNameTrim == "omeprazole") console.log(drugsIngredients);
      // console.log(drugsIngredients);
      const sameDrugIngredients = drugsIngredients.find(
        (d) => d.isUnique == false
      );
      if (!sameDrugIngredients) {
        const insertDrugValues = [setid, drugNameTrim];
        await client.query("BEGIN");
        await client.query(insertDrugText, insertDrugValues);
        for (node in nodes) {
          if (!isNaN(new Number(node))) {
            const insertActiveIngredientValues = [nodes.get(node)];
            await client.query(
              insertActiveIngredientText,
              insertActiveIngredientValues
            );
            const insertDrugIngredientValues = [setid, nodes.get(node)];
            await client.query(
              insertDrugIngredientText,
              insertDrugIngredientValues
            );
            await client.query("COMMIT");
            console.log("commit ", setid);
          }
        }
      }
    } catch (error) {
      console.log(error, setid);
    }
  }
}

function compareSets(array1, array2) {
  const set1 = new Set(array1);
  const set2 = new Set(array2);

  const compareSet = new Set([...set1, ...set2]);
  const isSetEqual =
    compareSet.size === set2.size && compareSet.size === set1.size;

  return isSetEqual;
}

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
    let drugsUrl =
      // "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?doctype=34391-3";
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?doctype=34391-3&page=306&pagesize=100";

    // "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?doctype=34391-3&page=108&pagesize=100";
    while (drugsUrl != "null") {
      let response = await fetch(drugsUrl);
      const result = await response.json();

      await processArray(result.data, drugsUrl, client);
      console.log("Completed ", drugsUrl);
      drugsUrl = result.metadata.next_page_url;
    }

    await client.query("COMMIT");
    console.log(`COMMIT !!!`);

    // drugInfo("7b3da447-8e7c-2aaa-e053-2a91aa0a2821", client);
  } catch (e) {
    await client.query("ROLLBACK");
    console.log("ROLLBACK");
    console.log(e);
    // throw e;
    exit(0);
  }
}

function drugInfo(setid) {
  const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setid}.xml`;
  return new Promise((resolve) => {
    request(url, (error, response, html) => {
      resolve({ error, response, html, setid });
    });
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
