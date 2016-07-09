
var fs   = require("fs");
var exec = require("child_process").exec;

var tss_path = "../bin/tss.js";

var PREFIX = __dirname.replace(/\\/g,"/");
var NODE_MODULES = require.resolve('typescript').replace(/\/typescript\/.*$/,'');

var tests = [], log = {}, done = {};
var filter = process.argv[2] && new RegExp(process.argv[2]);

function test(scriptName,fileName,options) {
  if (filter && !filter.test(scriptName)) return;
  var script = fs.readFileSync(scriptName,"utf8")
                 .replace(/PREFIX/g,PREFIX)
                 .replace(/NODE_MODULES/g,NODE_MODULES);

  var cmd = "node "+tss_path+(options?" "+options:"")+" "+fileName;
  tests.push(scriptName);
  log[scriptName] = ["// "+scriptName,cmd];

  var tss = exec(cmd
                ,{maxBuffer:Infinity}
                ,function(error, stdout, stderr) {
                   log[scriptName].push("// stdout");
                   log[scriptName].push(stdout.replace(new RegExp(PREFIX,"g"),"PREFIX")
                                              .replace(new RegExp(NODE_MODULES,"g"),"NODE_MODULES")
                                              .replace(/(,"|,{)/g,'\n  $1')
                                              .replace(/\\r\\n/g,'\\n'));
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
test("partial-update.script","empty.ts");
test("update-nocheck-completion-chain.script","empty.ts");
test("issue-15.script","issue-15.ts","-m commonjs");
test("issue-17.script","issue-17.ts","-m commonjs");
test("concat-map.script","empty.ts");
test("issue-52.script","empty.ts");
