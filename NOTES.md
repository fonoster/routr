Few notes to myself :)

Use the following Java options to enable the jvm profiler

```bash
ROUTR_JAVA_OPTS=-javaagent:$BASE_DIR/libs/jvm-profiler-master-SNAPSHOT.jar=reporter=com.uber.profiling.reporters.FileOutputReporter,outputDir=$BASE_DIR/out,tag=routr,metricInterval=5000
```
