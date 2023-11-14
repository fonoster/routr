# Development with Gitpod

Development mode with Gitpod is a great way to get familiar with Routr. Gitpod is a cloud-based IDE that allows you to develop and test your code in a browser. Gitpod is free for open-source projects and offers a free trial for private repositories.

To launch a Gitpod workspace, click the button below:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/fonoster/routr)

This link will open a new tab on your browser and start a new workspace, which may take a few minutes. The starting process might take a few minutes. Once the workspace is ready, you will see a terminal and a file explorer similar to VSCode.

While the workspace starts, let's review the steps required to forward SIP signaling traffic from your local computer to Gitpod.

First, add your public SSH keys to your Gitpod account by going to the Gitpod account keys and adding your public key. You can do this using the link below:

https://gitpod.io/user/keys

![Gitpod account keys](/img/gitpod-account-keys.png)

On Linux or macOS, you can find your public key by running the following command in your terminal:

```bash
cat ~/.ssh/id_rsa.pub
```

Or, if you are using Windows, you can find your public key using this command in your terminal:

```bash
cat %USERPROFILE%\.ssh\id_rsa.pub
```

If you don't have a public key, you can generate one by running the following command in your terminal:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Once you add your key, find your Gitpod workspace and click the "More" button. Then, select "Connect via SSH."

https://gitpod.io/workspaces

![Gitpod workspace](/img/gitpod-workspace.png)

You want to be able to access port `5060` from your local computer to connect to Routr using a SIPUA. We must create a port-forward from our local machine to the Gitpod workspace to do that.

To create the port forward, take the SSH connection string and add `-L 5060:localhost:5060` to the end of the line. For example, your command might look like this:

```bash
ssh <workspace-ssh-connection> -L 5060:localhost:5060
```

Be sure to replace "workspace SSH connection" with your local connection.

Here is an example of what the command might look like:

```bash
ssh fonoster-routr-mn8nsx0d9px@fonoster-routr-mn8nsx0d9px.ssh.ws-us90.gitpod.io -L 5060:localhost:5060 
```

This command forwards traffic from your local port `5060` to your Gitpod workspace's port `5060`, allowing you to connect via SIP.

> Unfortunately, SSH does not natively support forwarding UDP traffic. It only provides port forwarding functionality for TCP connections. Therefore, you cannot enable UDP delivering directly with the previous SSH Command.

This setup uses the "simpledata" implementation of the APIServer, which uses YAML files as the data source. Here is a list of the YAML files that make up the configuration:

https://github.com/fonoster/routr/blob/main/config/resources

Feel free to explore these files and make changes as needed.