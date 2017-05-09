/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getGatewaysCmd(ref, filters) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('gateways/' + filters)

    if (result.status != 200) {
         print(result.message)
         quit(0)
    }

    const gateways = result.obj

    if (gateways.length == 0) {
        print("Resource not found.")
        quit(0)
    }

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('USER')
        .nextCell().addLine('DESC')
        .nextCell().addLine('HOST')
        .nextCell().addLine('REGS')

    gateways.forEach(g => {
        if (ref.equals('none') || ref.equals(g.metadata.ref)) {
            let registries = g.spec.regService.registries || undefined

            textTable.nextRow()
                .nextCell().addLine(g.metadata.ref)
                .nextCell().addLine(g.spec.regService.credentials.username)
                .nextCell().addLine(g.metadata.name)
                .nextCell().addLine(g.spec.regService.host)
                .nextCell().addLine(registries.join())
        }
    })

    let grid = textTable.toGrid()
    grid = Border.DOUBLE_LINE.apply(grid);
    TUtil.print(grid)
}
