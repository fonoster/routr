/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getPeersCmd(ref, filter) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('peers/' + filter)

    if (result.status != 200) {
         print(result.message)
         quit(0)
    }

    const peers = result.obj

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('NAME')
        .nextCell().addLine('HOST')

    let cnt = 0

    peers.forEach(p => {
        if (ref.equals('none') || ref.equals(p.spec.credentials.username)) {
            textTable.nextRow()
                .nextCell().addLine(p.spec.credentials.username)
                .nextCell().addLine(p.metadata.name)
                .nextCell().addLine(p.spec.host)
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