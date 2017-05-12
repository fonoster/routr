/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getGatewaysCmd(ref, filter) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('gateways/' + filter)

    if (result.status != 200) {
         print(result.message)
         quit(0)
    }

    const gateways = result.obj

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('USER')
        .nextCell().addLine('DESC')
        .nextCell().addLine('HOST')
        .nextCell().addLine('REGS')

    let cnt = 0

    gateways.forEach(g => {
        if (ref.equals('none') || ref.equals(g.metadata.ref)) {
            let registries = g.spec.regService.registries || undefined

            textTable.nextRow()
                .nextCell().addLine(g.metadata.ref)
                .nextCell().addLine(g.spec.regService.credentials.username)
                .nextCell().addLine(g.metadata.name)
                .nextCell().addLine(g.spec.regService.host)
                .nextCell().addLine(registries.join())
            cnt++
        }
    })

    if (cnt > 0) {
        let grid = textTable.toGrid()
        grid = Border.DOUBLE_LINE.apply(grid);
        TUtil.print(grid)
    } else {
        print("Resource/s not found.")
    }
}
