load('./node_modules/jvm-npm/src/main/javascript/jvm-npm.js')

var TestCase = Java.type('junit.framework.TestCase')
var TestSuite = Java.type('junit.framework.TestSuite')
var TestResult = Java.type('junit.framework.TestResult')
// Assertions
var assertEquals = Java.type('org.junit.Assert').assertEquals
var assertNotEquals = Java.type('org.junit.Assert').assertNotEquals
var assertTrue = Java.type('org.junit.Assert').assertTrue
var assertFalse = Java.type('org.junit.Assert').assertFalse
var assertArrayEquals = Java.type('org.junit.Assert').assertArrayEquals
var assertNotNull = Java.type('org.junit.Assert').assertNotNull
var assertSame = Java.type('org.junit.Assert').assertSame
var assertNotSame = Java.type('org.junit.Assert').assertNotSame
var fail = Java.type('org.junit.Assert').fail

var ANSI_GREEN = "\u001B[32m"
var ANSI_YELLOW = "\u001B[33m"
var ANSI_RESET = "\u001B[0m"
var ANSI_RED = "\u001B[31m"

var THelper =  {
    test: function (path, name) {
        // WARN: This line makes makes the helper less portable
        var obj = require(path).testGroup

        if (obj === undefined) {
            print ('Nothing to test')
            return
        }

        var group = name !== undefined? name : obj.name

        if (obj.enabled === false) {
            print('Test group', "'" + group + "'", ANSI_YELLOW + '#disabled' + ANSI_RESET)
            return
        }

        print('Test group \'' + group + '\'')

        for (var key in obj){
            var funName = key
            var fun = obj[key]

            if (typeof fun !== "function") continue
            if (funName === "setup" || funName === "teardown") continue

            var TCase = Java.extend(TestCase, {
                runTest: fun
            })

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

if (tests.length === 0) {
    print ('Nothing to test')
}

tests.forEach(function(t) {
    THelper.test('node_modules/@routr/' + t)
})
