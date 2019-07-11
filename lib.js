const fetch = require("node-fetch");

function throwError(error) {
  throw new Error(JSON.stringify(error));
}

const requestGithubToken = credentials =>
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    encoding: null,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(credentials)
  })
    .then(res => res.json())
    .catch(throwError);

const requestGithubUserAccount = token =>
  fetch(`https://api.github.com/user?access_token=${token}`)
    .then(res => res.json())
    .catch(throwError);

module.exports = {
  authorizeWithGithub: async function authorizeWithGithub(credentials) {
    const { access_token } = await requestGithubToken(credentials);
    console.log(access_token);
    const githubUser = await requestGithubUserAccount(access_token);
    return { ...githubUser, access_token };
  }
};
