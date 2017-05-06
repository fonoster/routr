/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdShowLocation(id) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const registry = getWithAuth('location')

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine("ADDRESS OF RECORD")
        .nextCell().addLine("CONTACT INFO")

    registry.forEach(reg => textTable.nextRow().nextCell().addLine(reg.addressOfRecord).nextCell().addLine(reg.contactInfo))

    let grid = textTable.toGrid()
    grid = Border.DOUBLE_LINE.apply(grid);
    TUtil.print(grid)
}