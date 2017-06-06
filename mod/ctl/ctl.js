/**
 * @author Pedro Sanders
 * @since v1
 */
import CommandLocate from 'ctl/cmd_locate'
import CommandCreate from 'ctl/cmd_create'
import CommandApply from 'ctl/cmd_apply'
import CommandGet from 'ctl/cmd_get'
import CommandDel from 'ctl/cmd_delete'
import CommandStop from 'ctl/cmd_stop'
import CommandReg from 'ctl/cmd_registry'

// Just to avoid the annoying old log4j messages
org.apache.log4j.BasicConfigurator.configure(new
    org.apache.log4j.varia.NullAppender())

const ArgumentParsers = Packages.net.sourceforge.argparse4j.ArgumentParsers
const parser = ArgumentParsers.newArgumentParser('sipioctl')
    .description('sipioctl controls the Sip I/O server')
    .epilog('Find more information at https://github.com/psanders/sipio/wiki')
const subparsers = parser.addSubparsers().title('Basic Commands').metavar('COMMAND')

// Adding subparsers
const cmdCreate = new CommandCreate(subparsers)
const cmdApply = new CommandApply(subparsers)
const cmdGet = new CommandGet(subparsers)
const cmdDel = new CommandDel(subparsers)
const cmdLocate = new CommandLocate(subparsers)
const cmdStop = new CommandStop(subparsers)
const cmdRegistry = new CommandReg(subparsers)

try {
    // Variable 'args' is a global coming from the entry point script
    const res = parser.parseArgs(args)

    switch (args[0]) {
        case 'create':
        case 'crea':
            cmdCreate.run(res.get('f'))
            break
        case 'get':
            cmdGet.run(res.get('resource'), res.get('REF'), res.get('filter'))
            break
        case 'apply':
            cmdApply.run(res.get('f'))
            break
        case 'delete':
        case 'del':
            cmdDel.run(res.get('resource'), res.get('REF'), res.get('filter'))
            break
        case 'locate':
        case 'loc':
            cmdLocate.run()
            break
        case 'registry':
        case 'reg':
            cmdRegistry.run()
            break
        case 'stop':
            cmdStop.run()
            break
        default:
            throw 'This is not possible'
    }
} catch(e) {
    if (e instanceof Packages.com.mashape.unirest.http.exceptions.UnirestException) {
        print ('Sip I/O server is not running')
        exit(1)
    } else {
        parser.handleError(e)
    }
}
