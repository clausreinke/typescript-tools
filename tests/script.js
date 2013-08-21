
var fs   = require("fs");
var exec = require("child_process").exec;

var tss_path = "../bin/tss.js";

var PREFIX = __dirname.replace(/\\/g,"/");

function test(scriptName,fileName) {
  var script = fs.readFileSync(scriptName,"utf8")
                 .replace(/PREFIX/g,PREFIX);

  var cmd = "node "+tss_path+" "+fileName;
  console.log(cmd);

  var tss = exec(cmd
                ,{maxBuffer:Infinity}
                ,function(error, stdout, stderr) {
                   console.log("// stdout");
                   console.log(stdout.replace(new RegExp(PREFIX,"g"),"PREFIX")
                                     .replace(/(,"|,{)/g,'\n  $1'));
                   console.log("// stderr");
                   console.log(stderr);
                   if (error) console.log("// error: "+error);
                 });
  tss.stdin.write(script);
  tss.stdin.end();
}
test("test.script","test.ts");
test("issue-9.script","issue-9.ts");
