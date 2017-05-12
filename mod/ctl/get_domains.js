/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getDomainsCmd(ref, filter) {
    const SimpleTable = Packages.com.inamik.text.tables.SimpleTable
    const Border = Packages.com.inamik.text.tables.grid.Border;
    const TUtil = com.inamik.text.tables.grid.Util

    const result = getWithAuth('domains/' + filter)

    if (result.status != 200) {
         print(result.message)
         quit(0)
    }

    const domains = result.obj

    const textTable = SimpleTable.of()
        .nextRow()
        .nextCell().addLine('REF')
        .nextCell().addLine('NAME')
        .nextCell().addLine('EGRESS POLICY')
        .nextCell().addLine('ACL')

    let cnt = 0

    domains.forEach(d => {
        if (ref.equals('none') || ref.equals(d.spec.context.domainUri)) {
            let accessControlList = {}
            let egressPolicy = {}

            if (d.spec.context.accessControlList ) {
                accessControlList = d.spec.context.accessControlList
            }

            if (d.spec.context.egressPolicy) {
                egressPolicy = d.spec.context.egressPolicy
            }

            textTable.nextRow()
                .nextCell().addLine(d.spec.context.domainUri)
                .nextCell().addLine(d.metadata.name)
                .nextCell().addLine(JSON.stringify(egressPolicy))
                .nextCell().addLine(JSON.stringify(accessControlList))

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