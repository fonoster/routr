/**
 * @author Pedro Sanders
 * @since v1
 */
export default function getKind(obj) {
    if (!obj.kind || (
        obj.kind.toLowerCase != 'user' &&
        obj.kind.toLowerCase() != 'agent' &&
        obj.kind.toLowerCase() != 'peer' &&
        obj.kind.toLowerCase() != 'domain' &&
        obj.kind.toLowerCase() != 'gateway' &&
        obj.kind.toLowerCase() != 'did')) {
        throw "Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, DID"
    }

    return obj.kind
}
