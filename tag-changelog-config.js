/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
 *
 * This file is part of Routr.
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
module.exports = {
  types: [
    { types: ["feat", "feature"], label: "🎉 New Features" },
    { types: ["fix", "bugfix"], label: "🐛 Bugfixes" },
    { types: ["improvements", "enhancement"], label: "🔨 Improvements" },
    { types: ["perf"], label: "🏎️ Performance Improvements" },
    { types: ["build", "ci"], label: "🏗️ Build System" },
    { types: ["refactor"], label: "🪚 Refactors" },
    { types: ["doc", "docs"], label: "📚 Documentation Changes" },
    { types: ["test", "tests"], label: "🔍 Tests" },
    { types: ["style"], label: "💅 Code Style Changes" },
    { types: ["chore"], label: "🧹 Chores" },
    { types: ["other"], label: "Other Changes" }
  ],

  excludeTypes: ["other"],

  capitalizeFirstLetter: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  },

  renderTypeSection: function (label, commits) {
    let text = `\n## ${label}\n`

    commits.forEach((commit) => {
      const capitalizedSubject = this.capitalizeFirstLetter(commit.subject)
      text += `- ${capitalizedSubject}\n`
    })

    return text
  },

  renderChangelog: function (release, changes) {
    const now = new Date()
    return (
      `# ${release} - ${now.toISOString().substr(0, 10)}\n` + changes + "\n\n"
    )
  }
}
