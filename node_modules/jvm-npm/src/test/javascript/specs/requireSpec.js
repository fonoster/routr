/**
 *  Copyright 2014 Lance Ball
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
// Make the native require function look in our local directory
// for modules loaded with NativeRequire.require()

var cwd = [java.lang.System.getProperty('user.dir'),
           'src/test/javascript/specs'].join('/');

var home = java.lang.System.getProperty('user.home');

require.pushLoadPath(cwd);

// Load the NPM module loader into the global scope
load('src/main/javascript/jvm-npm.js');

// Tell require where it's root is
require.root = cwd;


beforeEach(function() {
  require.cache = [];
});

describe("NativeRequire", function() {

  it("should be a global object", function(){
    expect(typeof NativeRequire).toBe('object');
  });

  it("should expose DynJS' builtin require() function", function(){
    expect(typeof NativeRequire.require).toBe('function');
    var f = NativeRequire.require('./lib/native_test_module');
    expect(f).toBe("Foo!");
    expect(NativeRequire.require instanceof org.dynjs.runtime.builtins.Require)
      .toBe(true);
  });

  it("should fall back to builtin require() if not found", function() {
    var called = false;
    NativeRequire.require = function() {
      called = true;
      return "Got native module";
    };
    var native = require('not_found');
    expect(native).toBe("Got native module");
    expect(called).toBe(true);
  });

});

describe("NPM global require()", function() {

  it("should be a function", function() {
    expect(typeof require).toBe('function');
  });

  it("should have a resolve() property that is a function", function() {
    expect(typeof require.resolve).toBe('function');
  });

  it("should have a cache property that is an Object", function() {
    expect(typeof require.cache).toBe('object');
  });

  it("should have an extensions property that is an Object", function() {
    expect(typeof require.extensions).toBe('object');
  });

  it("should find and load files with a .js extension", function() {
    // Ensure that the npm require() is not using NativeRequire
    var that=this;
    NativeRequire.require = function() {
      that.fail("NPM require() should not use DynJS native require");
    };
    expect(require('./lib/native_test_module')).toBe("Foo!");
  });

  it("should throw an Error if a file can't be found", function() {
    expect(function() {require('./not_found.js');}).toThrow(new Error('Cannot find module ./not_found.js'));
    try {
      require('./not_found.js');
    } catch(e) {
      expect(e.code).toBe('MODULE_NOT_FOUND');
    }
  });

  it("should not wrap errors encountered when loading a module", function() {
    try {
      require('./lib/throws');
    } catch(ex) {
      print(ex);
      expect(ex instanceof ReferenceError).toBeTruthy();
    }
  });

  it("should support nested requires", function() {
    var outer = require('./lib/outer');
    expect(outer.quadruple(2)).toBe(8);
  });

  it("should support an ID with an extension", function() {
    var outer = require('./lib/outer.js');
    expect(outer.quadruple(2)).toBe(8);
  });

  it("should return the a .json file as a JSON object", function() {
    var json = require('./lib/some_data.json');
    expect(json.description).toBe("This is a JSON file");
    expect(json.data).toEqual([1,2,3]);
  });

  it("should cache modules in require.cache", function() {
    var outer = require('./lib/outer.js');
    expect(outer).toBe(require.cache[outer.filename]);
    var outer2 = require('./lib/outer.js');
    expect(outer2).toBe(outer);
  });

  it("should handle cyclic dependencies", function() {
    var main = require('./lib/cyclic');
    expect(main.a.fromA).toBe('Hello from A');
    expect(main.b.fromB).toBe('Hello from B');
  });

  describe("folders as modules", function() {
    it("should find package.json in a module folder", function() {
      var package = require('./lib/other_package');
      expect(package.flavor).toBe('cool ranch');
      expect(package.subdir).toBe([cwd, 'lib/other_package/lib/subdir'].join('/'));
    });

    it('should load package.json main property even if it is a directory', function() {
      var cheese = require('./lib/cheese');
      expect(cheese.flavor).toBe('nacho');
    });

    it("should find index.js in a directory, if no package.json exists", function() {
      var package = require('./lib/my_package');
      expect(package.data).toBe('Hello!');
    });
  });

  describe("node_modules folders", function() {

    it("should load file modules from the node_modules folder in cwd", function() {
      var top = require('./lib/a_package');
      expect(top.file_module).toBe('Hello from a file module');
    });

    it("should load package modules from the node_modules folder", function() {
      var top = require('./lib/a_package');
      expect(top.pkg_module.pkg).toBe('Hello from a package module');
    });

    it("should find node_module packages in the parent path", function() {
      var top = require('./lib/a_package');
      expect(top.pkg_module.file).toBe('Hello from a file module');
    });

    it("should find node_module packages from a sibling path", function() {
      var top = require('./lib/a_package');
      expect(top.parent_test.parentChanged).toBe(false);
    });

    it('should find node_module packages all the way up above cwd', function() {
      var m = require('root_module');
      expect(m.message).toBe('You are at the root');
    });

  });

});

describe("NPM Module execution context", function() {

  it("should have a __dirname property", function() {
    var top = require('./lib/simple_module');
    expect(top.dirname).toBe([cwd, 'lib'].join('/'));
  });

  it("should have a __filename property", function() {
    var top = require('./lib/simple_module');
    expect(top.filename).toBe([cwd, 'lib/simple_module.js'].join('/'));
  });

  it("should not expose private module functions globally", function() {
    var top = require('./lib/simple_module');
    expect(top.privateFunction).toBe(undefined);
  });

  it("should have a parent property", function() {
    var outer = require('./lib/outer');
    expect(outer.innerParent.id).toBe([cwd, 'lib/outer.js'].join('/'));
  });

  it("should have a filename property", function() {
    var outer = require('./lib/outer');
    expect(outer.filename).toBe([cwd, 'lib/outer.js'].join('/'));
  });

  it("should have a children property", function() {
    var outer = require('./lib/outer');
    expect(outer.children.length).toBe(1);
    expect(outer.children[0].id).toBe([cwd, 'lib/sub/inner.js'].join('/'));
  });

  it("should support setting the 'free' exports variable", function() {
    var modExports = require('./lib/mod_exports');
    expect(modExports.data).toBe("Hello!");
  });

});

describe("module isolation", function() {
  it("should expose global variables and not expose 'var' declared variables", function() {
    var top = require( './lib/isolation/module-a.js');
    expect(doLeak).toBe("cheddar");
    try {
      var shouldFail = doNotLeak;
      // should have thrown
      expect(true).toBe(false);
    } catch (err) {
      expect( err instanceof ReferenceError ).toBe(true);
    }
  });

  it("should not leak function declarations", function() {
    var top = require('./lib/isolation/module-c.js');
    try {
      var shouldFail = doNotLeak;
      // should have thrown
      expect(true).toBe(false);
    } catch (err) {
      expect( err instanceof ReferenceError ).toBe(true);
    }
  });
});

describe("cyclic with replacement of module.exports", function() {
  it( "should have the same sense of an object in all places", function() {
    var Stream = require( "./lib/cyclic2/stream.js" );

    expect( typeof Stream ).toBe( "function"  );
    expect( typeof Stream.Readable ).toBe( "function" );
    expect( typeof Stream.Readable.Stream ).toBe( "function" );

  });
});

describe("Core modules", function() {
  it("should be found on the classpath", function() {
    var core = require('core');
    expect(core).not.toBeFalsy();
  });

  it( "should have the same sense of an object in all places", function() {
    var Core = require( "core.js" );

    expect( typeof Core ).toBe( "function"  );
    expect( typeof Core.Child ).toBe( "function" );
    expect( typeof Core.Child.Core ).toBe( "function" );

  });
});

describe("Path management", function() {
  it( "should respect NODE_PATH variable", function() {
    require.NODE_PATH = 'foo:bar';
    var results = require.paths();
    expect( results[0] ).toBe( home + "/.node_modules" );
    expect( results[1] ).toBe( home + "/.node_libraries" );
    expect( results[2] ).toBe( 'foo' );
    expect( results[3] ).toBe( 'bar' );
    //java.lang.System.err.println( results );

  });
});

describe("The Module module", function() {
  it('should exist', function() {
    var Module = require('jvm-npm');
    expect(Module).toBeTruthy();
  });

  it('should have a runMain function', function() {
    var Module = require('jvm-npm');
    expect(typeof Module.runMain).toBe('function');
  });
});
