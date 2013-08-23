
var fs   = require("fs");
var exec = require("child_process").exec;

var tss_path = "../bin/tss.js";

var PREFIX = __dirname.replace(/\\/g,"/");

var tests = [], log = {}, done = {};

function test(scriptName,fileName) {
  var script = fs.readFileSync(scriptName,"utf8")
                 .replace(/PREFIX/g,PREFIX);

  var cmd = "node "+tss_path+" "+fileName;
  tests.push(scriptName);
  log[scriptName] = ["// "+scriptName,cmd];

  var tss = exec(cmd
                ,{maxBuffer:Infinity}
                ,function(error, stdout, stderr) {
                   log[scriptName].push("// stdout");
                   log[scriptName].push(stdout.replace(new RegExp(PREFIX,"g"),"PREFIX")
                                              .replace(/(,"|,{)/g,'\n  $1'));
                   log[scriptName].push("// stderr");
                   log[scriptName].push(stderr);
                   if (error) log[scriptName].push("// error: "+error);

                   done[scriptName] = true;
                   collectResults();
                 });
  tss.stdin.write(script);
  tss.stdin.end();
}
function collectResults() {
  while (done[tests[0]]) {
    console.log( log[tests[0]].join('\n') )
    tests.shift();
  }
}
test("test.script","test.ts");
test("issue-9.script","empty.ts");
test("issue-10.script","empty.ts");
test("issue-11.script","empty.ts");
test("issue-12.script","empty.ts");
test("issue-13.script","empty.ts");
