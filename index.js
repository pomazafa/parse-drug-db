const https = require("https");
const parseString = require("xml2js").parseString;
const jp = require("jsonpath");

let setId = 
// const url =
//   "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/1e0ae43a-037f-42af-8e23-a0e51d75abe8.xml";
// fs = require("fs");

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
