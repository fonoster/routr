
{
  git tag -d 1.0.0-rc4
  git push origin :refs/tags/1.0.0-rc4
} 2> /dev/null

git tag 1.0.0-rc4
git push
git push --tags
