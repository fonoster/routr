/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getAgentsCmd(ref, filter) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('agents/' + filter)

    if (result.status != 200) {
         print(result.message)
         quit(1)
    }

    const agents = result.obj

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('USERNAME')
        .nextCell().addLine('NAME')
        .nextCell().addLine('DOMAIN(S)')

    let cnt = 0

    agents.forEach(a => {
        const genRef = a.spec.credentials.username + '-' + a.spec.domains[0].hashCode().toString().substring(6)

        if (ref.equals('none') || genRef.equals(ref)) {
            textTable.nextRow()
                 .nextCell().addLine(genRef)
                .nextCell().addLine(a.spec.credentials.username)
                .nextCell().addLine(a.metadata.name)
                .nextCell().addLine(a.spec.domains.join())

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