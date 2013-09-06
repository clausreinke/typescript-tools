/*
declare module 'issue-15-import' {
  export class Background { public a; public b; init() }
}
*/

import Background = require('issue-15-import');

class Test {

  public test_var;

  constructor(){ }

  public test_method(){ }

}

function main(){

  var xx = new Background.noSuchExport();
  var bg = new Background.Class();
  xx.noSuchProperty();
  bg.noSuchProperty();

  var test = new Test()
  test.test_method();

}

