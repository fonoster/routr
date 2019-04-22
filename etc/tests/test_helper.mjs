load('./node_modules/jvm-npm/src/main/javascript/jvm-npm.js')

var TestCase = Packages.junit.framework.TestCase
var TestSuite = Packages.junit.framework.TestSuite
var TestResult = Packages.junit.framework.TestResult
// Assertions
var assertEquals = Packages.org.junit.Assert.assertEquals
var assertNotEquals = Packages.org.junit.Assert.assertNotEquals
var assertTrue = Packages.org.junit.Assert.assertTrue
var assertFalse = Packages.org.junit.Assert.assertFalse
var assertArrayEquals = Packages.org.junit.Assert.assertArrayEquals
var assertNotNull = Packages.org.junit.Assert.assertNotNull
var assertSame = Packages.org.junit.Assert.assertSame
var assertNotSame = Packages.org.junit.Assert.assertNotSame
var fail = Packages.org.junit.Assert.fail

var ANSI_GREEN = "\u001B[32m"
var ANSI_YELLOW = "\u001B[33m"
var ANSI_RESET = "\u001B[0m"
var ANSI_RED = "\u001B[31m"

var THelper =  {
    test: function (path, name) {
        // WARN: This line makes makes the helper less portable
        var obj = require(path).testGroup

        if (obj == undefined) {
            print ('Nothing test found')
            return
        }

        var group = name != undefined? name : obj.name

        if (obj.enabled === false) {
            print('Test group', "'" + group + "'", ANSI_YELLOW + '#disabled' + ANSI_RESET)
            return
        } else {
            print('Test group \'' + group + '\'')
        }

        for (var key in obj){
            var funName = key;
            var fun = obj[key];

            if (typeof fun != "function") continue
            if (funName == "setup" || funName == "teardown") continue

            var TCase = Java.extend(TestCase, {
                runTest: fun
            });

            var result = new TCase().run()

            if (result.wasSuccessful()) {
                print(' ', '[', funName, '] =>', ANSI_GREEN + 'passed' + ANSI_RESET)
            } else {
                print(' ', '[', funName, '] =>', ANSI_RED + 'failed' + ANSI_RESET)

                var errors = result.errors()
                while (errors.hasMoreElements()) {
                    print(' ', '[x]', errors.nextElement());
                }
            }
       }
    }
}

var tests = $ARG

if (tests.length == 0) {
    print ('Nothing test found')
}

tests.forEach(function(t) {
    THelper.test(t)
})
