/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getPeersCmd(ref, filters) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('peers/' + filters)

    if (result.status != 200) {
         print(result.message)
         return
    }

    const peers = result.obj

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('NAME')
        .nextCell().addLine('HOST')

    peers.forEach(p => {
        if (ref.equals('none') || ref.equals(p.spec.access.username)) {
            textTable.nextRow()
                .nextCell().addLine(p.spec.access.username)
                .nextCell().addLine(p.metadata.name)
                .nextCell().addLine(p.spec.host)
        }
    })

    let grid = textTable.toGrid()
    grid = Border.DOUBLE_LINE.apply(grid);
    TUtil.print(grid)
}