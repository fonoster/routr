/**
 * @author Pedro Sanders
 * @since v1
 */
import CtlUtils from 'ctl/ctl_utils'

const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
const Border = Packages.com.inamik.text.tables.grid.Border
const TUtil = com.inamik.text.tables.grid.Util

export default class CommandLocate {

    constructor(subparsers) {
        subparsers.addParser('locate').aliases(['loc']).help('locate sip device(s)')
        this.ctlUtils = new CtlUtils()
    }

    run(id) {
        const ctlUtils = this.ctlUtils

        const registry = ctlUtils.getWithAuth('locate')
        const textTable = SimpleTable.of()
            .nextRow()
            .nextCell().addLine("ADDRESS OF RECORD")
            .nextCell().addLine("CONTACT INFO")

        registry.forEach(reg => textTable.nextRow().nextCell().addLine(reg.addressOfRecord).nextCell().addLine(reg.contactInfo))

        if (registry.length > 0) {
            let grid = textTable.toGrid()
            grid = Border.DOUBLE_LINE.apply(grid)
            TUtil.print(grid)
        } else {
            print("No registered devices at this time.")
        }
    }
}

