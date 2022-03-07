# Development Scripts
Repository of scripts the be used in the WordPress software development pipelines.

## How to deploy
- Bump minor version of scripts in package.json.
- run `git tag 0._._` following semantic versioning.
- Commit changes.
- `git push`
- `git push --tags`
- `npm publish`
