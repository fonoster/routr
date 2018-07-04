/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

class Footer extends React.Component {
  docUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    return baseUrl + 'docs/' + (language ? language + '/' : '') + doc;
  }

  pageUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    return baseUrl + (language ? language + '/' : '') + doc;
  }

  render() {
    const currentYear = new Date().getFullYear();
    return (
      <footer className="nav-footer" id="footer">
        <section className="sitemap">
          { false && <a href={this.props.config.baseUrl} className="nav-home">
            {this.props.config.footerIcon && (
              <img
                src={this.props.config.baseUrl + this.props.config.footerIcon}
                alt={this.props.config.title}
                width="66"
              />
            )}
          </a>}
          <div>
            <h5>Docs</h5>
            <a href={this.docUrl('../getting-started-installation.html', this.props.language)}>
              Getting Started
            </a>
            <a href={this.docUrl('../guide-securing-the-signal.html', this.props.language)}>
              Guides
            </a>
            <a href={this.docUrl('../api-reference.html', this.props.language)}>
              API Reference
            </a>
          </div>
          <div>
            <h5>Community</h5>
            <a href={"https://fonoster.com"}>
              User Showcase
            </a>
            <a
              href="http://stackoverflow.com/questions/tagged/sipio"
              target="_blank"
              rel="noreferrer noopener">
              Stack Overflow
            </a>
            <a href="https://gitter.im/sip-io/Lobby">Project Chat</a>
            <a
              href="https://twitter.com/fonoster"
              target="_blank"
              rel="noreferrer noopener">
              Twitter
            </a>
          </div>
          <div>
            <h5>More</h5>
            <a href={this.props.config.baseUrl + 'blog'}>Blog</a>
            <a href="https://github.com/fonoster/sipio">GitHub</a>
            <a
              className="github-button"
              href={this.props.config.repoUrl}
              data-icon="octicon-star"
              data-count-href={"/fonoster/sipio/stargazers"}
              data-show-count={true}
              data-count-aria-label="# stargazers on GitHub"
              aria-label="Star this project on GitHub">
              Star
            </a>
          </div>
        </section>

        <a
          href="https://fonoster.com"
          target="_blank"
          rel="noreferrer noopener"
          className="fbOpenSource">
          <img
            src={"http://fonoster.com/assets/images/logo.png"}
            alt="Fonoster Open Source"
            width="170"
          />
        </a>
        <section className="copyright">{this.props.config.copyright}</section>
      </footer>
    );
  }
}

module.exports = Footer;
