/**
 * @author Pedro Sanders
 * @since v1
 */
import CtlUtils from 'ctl/ctl_utils'
import moment from 'moment'

const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
const Border = Packages.com.inamik.text.tables.grid.Border
const TUtil = com.inamik.text.tables.grid.Util

export default class CommandLocate {

    constructor(subparsers) {
        subparsers.addParser('registry').aliases(['reg']).help('shows gateways registrations')
        this.ctlUtils = new CtlUtils()
    }

    run(id) {
        const ctlUtils = this.ctlUtils

        const registry = ctlUtils.getWithAuth('registry')
        const textTable = SimpleTable.of()
            .nextRow()
            .nextCell().addLine("USER")
            .nextCell().addLine("HOST")
            .nextCell().addLine("IP ADDRESS")
            .nextCell().addLine("REGISTERED")

        registry.forEach(reg => textTable.nextRow()
            .nextCell()
            .addLine(reg.username)
            .nextCell()
            .addLine(reg.host)
            .nextCell()
            .addLine(reg.ip)
            .nextCell()
            .addLine(moment(new Date(reg.registeredOn)).fromNow())
        )

        if (registry.length > 0) {
            let grid = textTable.toGrid()
            grid = Border.DOUBLE_LINE.apply(grid)
            TUtil.print(grid)
        } else {
            print("Not registered to any provider at this time.")
        }
    }
}

