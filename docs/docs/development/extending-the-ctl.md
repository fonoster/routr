# Extending the Command-Line Tool

Routr's command-line tool (CTL) is a powerful tool that lets you manage your Routr Connect server. Our team built the CTL with [Oclif](https://oclif.io/), a framework for creating command-line tools in Node.js.

You can extend the CTL by creating plugins with Oclif. This section guides you on how to extend the CTL with plugins.

## Installing the Command-Line Tool

The CTL comes as an npm package. To install it, you run the following command:

```bash
npm install --location=global @routr/ctl
```

## Using the Command-Line Tool

The CTL includes all the commands you need to interact with your Routr Connect server. Most commands follow a CRUD pattern. For managing your Agents, for instance, you have to create, delete, describe, and get commands.

Most commands adopt the `{substantive} {verb}` pattern. For instance, `rctl agents get` retrieves a list of agents.

If you want to extend the CTL, you create a plugin. Since developers built the CTL with Oclif, you can use the same framework to develop new plugins.

## Creating a plugin

To create a new plugin, you start by running the following command:

```bash
npx oclif generate mycommand
```

The system will prompt you for some information about your plugin. For this example, let's choose `mycommand` as the name.

In your mycommand directory, you'll find the following structure:

[Directory structure omitted for brevity]

Looking at the `src/commands/hello/index.ts` file, you see the following code:

[Sample TypeScript code omitted for brevity]

This code defines a simple command that takes two arguments, `person` and `from,` and then prints a greeting to the console.

After you update your plugin, you install and test it by running the following command from within the plugin directory:

```bash
rctl plugins link . # Installing in development mode
```

For production mode installation of your plugin, you use the following command:

```bash
rctl plugins install .
```

If you have published your plugin to [NPM](https://npmjs.com), you can install it with this command:

```bash
rctl plugins install mycommand
```

To see your new command in action, you run the command with the `--help` flag and follow the instructions.

With this example, you see how straightforward it is to create a new command. You can use the same pattern to create commands for Routr Connect and even utilize the [Node.js SDK](/docs/2.0.0/connect/nodesdk/sdk) to interact with the server.