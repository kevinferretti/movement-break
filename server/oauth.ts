import type { AuthProvider, OAuthProfile } from './dataStore'

type OAuthProviderConfig = {
  clientId: string
  clientSecret: string
}

type GitHubUser = {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string | null
}

type GitHubEmail = {
  email: string
  primary: boolean
  verified: boolean
}

type GoogleUser = {
  sub: string
  name?: string
  email?: string
  email_verified?: boolean
  picture?: string
}

export function getEnabledProviders() {
  return (['github', 'google'] as const).filter((provider) => Boolean(getProviderConfig(provider)))
}

export function createAuthorizationUrl(provider: AuthProvider, state: string, publicUrl: string) {
  const config = requireProviderConfig(provider)
  const redirectUri = getRedirectUri(provider, publicUrl)

  if (provider === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize')
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    }).toString()

    return url.toString()
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    prompt: 'select_account',
  }).toString()

  return url.toString()
}

export async function exchangeOAuthCode(provider: AuthProvider, code: string, publicUrl: string): Promise<OAuthProfile> {
  if (provider === 'github') {
    return exchangeGitHubCode(code, publicUrl)
  }

  return exchangeGoogleCode(code, publicUrl)
}

export function isAuthProvider(value: string): value is AuthProvider {
  return value === 'github' || value === 'google'
}

function getProviderConfig(provider: AuthProvider): OAuthProviderConfig | null {
  if (provider === 'github') {
    return createConfig(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET)
  }

  return createConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
}

function requireProviderConfig(provider: AuthProvider) {
  const config = getProviderConfig(provider)

  if (!config) {
    throw new Error(`${provider} OAuth is not configured.`)
  }

  return config
}

function createConfig(clientId: string | undefined, clientSecret: string | undefined) {
  if (!clientId || !clientSecret) {
    return null
  }

  return {
    clientId,
    clientSecret,
  }
}

async function exchangeGitHubCode(code: string, publicUrl: string): Promise<OAuthProfile> {
  const config = requireProviderConfig('github')
  const token = await requestJson<{ access_token?: string }>('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: getRedirectUri('github', publicUrl),
    }),
  })

  if (!token.access_token) {
    throw new Error('GitHub did not return an access token.')
  }

  const user = await requestJson<GitHubUser>('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'movement-break',
    },
  })
  const emails = await requestJson<GitHubEmail[]>('https://api.github.com/user/emails', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'movement-break',
    },
  })
  const primaryEmail = emails.find((email) => email.primary && email.verified)?.email ?? user.email

  return {
    provider: 'github',
    providerUserId: String(user.id),
    displayName: user.name || user.login,
    avatarUrl: user.avatar_url,
    username: user.login,
    email: primaryEmail,
  }
}

async function exchangeGoogleCode(code: string, publicUrl: string): Promise<OAuthProfile> {
  const config = requireProviderConfig('google')
  const token = await requestJson<{ access_token?: string }>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri('google', publicUrl),
    }),
  })

  if (!token.access_token) {
    throw new Error('Google did not return an access token.')
  }

  const user = await requestJson<GoogleUser>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  })

  return {
    provider: 'google',
    providerUserId: user.sub,
    displayName: user.name || user.email || 'Google user',
    avatarUrl: user.picture ?? null,
    username: user.email ?? null,
    email: user.email_verified ? (user.email ?? null) : null,
  }
}

async function requestJson<Result>(url: string, init: RequestInit) {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`OAuth request failed with ${response.status}.`)
  }

  return response.json() as Promise<Result>
}

function getRedirectUri(provider: AuthProvider, publicUrl: string) {
  return new URL(`/api/auth/${provider}/callback`, publicUrl).toString()
}
