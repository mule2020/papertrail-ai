const REGION = import.meta.env.VITE_REGION as string;
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID as string;
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

async function cognito(target: string, body: object) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.__type || "Request failed");
  }
  return data;
}

export async function signUp(email: string, password: string): Promise<void> {
  await cognito("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognito("ConfirmSignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

/** Returns the ID token, which the API's JWT authorizer accepts. */
export async function signIn(email: string, password: string): Promise<string> {
  const data = await cognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  return data.AuthenticationResult.IdToken as string;
}