const System = Java.type('java.lang.System')

load('./node_modules/jvm-npm/src/main/javascript/jvm-npm.js')

const TestCase = Packages.junit.framework.TestCase
const TestSuite = Packages.junit.framework.TestSuite
const TestResult = Packages.junit.framework.TestResult
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

const ANSI_GREEN = "\u001B[32m"
const ANSI_YELLOW = "\u001B[33m"
const ANSI_RESET = "\u001B[0m"
const ANSI_RED = "\u001B[31m"

const THelper =  {
    test: function (path, name) {
        // WARN: This line makes makes the helper less portable
        const obj = require(path).testGroup

        if (obj == undefined) {
            print ('No test found')
            return
        }

        const group = name != undefined? name : obj.name

        if (obj.enabled === false) {
            print('Test group', "'" + group + "'", ANSI_YELLOW + '#disabled' + ANSI_RESET)
            return
        } else {
            print('Test group \'' + group + '\'')
        }

        for (const key in obj){
            const funName = key;
            const fun = obj[key];

            if (typeof fun != "function") continue
            if (funName == "setup" || funName == "teardown") continue

            const TCase = Java.extend(TestCase, {
                runTest: fun
            });

            const result = new TCase().run()

            if (result.wasSuccessful()) {
                print(' ', '[', funName, '] =>', ANSI_GREEN + 'passed' + ANSI_RESET)
            } else {
                print(' ', '[', funName, '] =>', ANSI_RED + 'failed' + ANSI_RESET)

                const errors = result.errors()
                while (errors.hasMoreElements()) {
                    print(' ', '[x]', errors.nextElement());
                }
            }
       }
    }
}

const tests = $ARG

if (tests.length == 0) {
    print ('Nothing test found')
}

tests.forEach(function(t) {
    THelper.test("../mod/" + t)
})
