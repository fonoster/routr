Few notes to myself :)

## Versioning

The versions of Routr's components will change at a different rate. To facilitate migration, I created a simple update policy inspired in Docker and Kubernetes.

### Server versioning

The server will follow a Semantic Versioning as describe at https://semver.org. In summary:

"""
Given a version number MAJOR.MINOR.PATCH, increment the:

MAJOR version when you make incompatible API changes,
MINOR version when you add functionality in a backwards compatible manner, and
PATCH version when you make backwards compatible bug fixes.
Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format.
"""

Every version of Routr will support a range of API versions. For example, Routr 1.0 can support APIs `v1beta1` to `v1`, where `v1beta1` is the "oldest" version supported and `v1` the most recent version supported.

### API versioning

APIs are divided in alpha, beta, stable. In summary:

**Alpha level**

If version names contain alpha (e.g. v1alpha1), it means that it may be buggy and enabling the feature may expose bugs. Support for alpha features may be dropped at any time without notice and are not recommended for production.

**Beta level**

The version names contain beta (e.g. v1beta2). Code is well tested. Enabling the feature is considered safe. Support for beta level APIs will not be dropped, though details may change. For example, the schema and/or semantics of objects may change in incompatible ways in a subsequent beta or stable release. When this happens, we will provide instructions for migrating to the next version. This may require deleting, editing, and re-creating API objects. The editing process may require some thought. This may require downtime for applications that rely on the feature.

Recommended for only non-business-critical uses because of potential for incompatible changes in subsequent releases. If you have multiple clusters which can be upgraded independently, you may be able to relax this restriction.

**Stable level**

The version name is `vX` where `X` is an integer. Stable versions of features will appear in released software for many subsequent versions.

### Resource versioning

Resources (Agents, Gateways, etc) will be tagged and match with an API version with the field `apiVersion`. The version contained in the `apiVersion` must be supported by the server. Also, the Resource could be store using a different schemma than the one you submitted.

## JVM profiler

Use the following Java options to enable the profiler

```bash
ROUTR_JAVA_OPTS=-javaagent:$BASE_DIR/libs/jvm-profiler-master-SNAPSHOT.jar=reporter=com.uber.profiling.reporters.FileOutputReporter,outputDir=$BASE_DIR/out,tag=routr,metricInterval=5000
```
