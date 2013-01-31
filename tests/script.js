
var fs   = require("fs");
var exec = require("child_process").exec;

var tss_path = "../bin/tss.js";

var PREFIX = __dirname.replace(/\\/g,"/");

var script = fs.readFileSync("test.script","utf8")
               .replace(/PREFIX/g,PREFIX);

var cmd = "node "+tss_path+" test.ts";
console.log(cmd);

var tss = exec(cmd,function(error, stdout, stderr) {
                     console.log("// stdout");
                     console.log(stdout.replace(new RegExp(PREFIX,"g"),"PREFIX"));
                     console.log("// stderr");
                     console.log(stderr);
                     if (error) console.log("// error: "+error);
                   });
tss.stdin.write(script);
tss.stdin.end();
