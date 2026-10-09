import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { AccountStack } from '../lib/account-stack'

function synth(githubOidcProvider: 'create' | 'import') {
  const app = new App()
  const stack = new AccountStack(app, 'Account', {
    env: { account: '111111111111', region: 'eu-central-1' },
    budgetEmail: 'test@example.com',
    githubOidcProvider,
  })
  return Template.fromStack(stack)
}

const bootstrapAssume = {
  Action: 'sts:AssumeRole',
  Effect: 'Allow',
  Resource: 'arn:aws:iam::111111111111:role/cdk-*',
  Condition: {
    StringEquals: {
      'iam:ResourceTag/aws-cdk:bootstrap-role': [
        'deploy',
        'file-publishing',
        'image-publishing',
        'lookup',
      ],
    },
  },
}

describe('AccountStack', () => {
  const t = synth('create')

  it('deployer trust needs MFA', () => {
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'mcptacticus-deployer',
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Condition: { Bool: { 'aws:MultiFactorAuthPresent': 'true' } },
          }),
        ],
      },
    })
  })

  it('deployer has the bootstrap assume and SSM only', () => {
    const [role] = Object.values(
      t.findResources('AWS::IAM::Role', { Properties: { RoleName: 'mcptacticus-deployer' } }),
    )
    const statements = role?.Properties.Policies[0].PolicyDocument.Statement
    expect(statements).toHaveLength(2)
    expect(statements[0]).toEqual(bootstrapAssume)
    expect(statements[1].Action).toEqual([
      'ssm:PutParameter',
      'ssm:GetParameter',
      'ssm:GetParameters',
      'ssm:GetParametersByPath',
      'ssm:DeleteParameter',
    ])
  })

  it('CI role has only the bootstrap assume', () => {
    const [role] = Object.values(
      t.findResources('AWS::IAM::Role', { Properties: { RoleName: 'mcptacticus-github-deploy' } }),
    )
    expect(role?.Properties.Policies[0].PolicyDocument.Statement).toEqual([bootstrapAssume])
  })

  it('CI trust has the exact aud and sub', () => {
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'mcptacticus-github-deploy',
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub':
                  'repo:PompolutZ@927235/mcp_tacticus_3d@1391287590:environment:prod',
              },
            },
          }),
        ],
      },
    })
  })

  it('creates one OIDC provider with "create"', () => {
    t.resourceCountIs('AWS::IAM::OIDCProvider', 1)
  })

  it('creates none with "import"', () => {
    synth('import').resourceCountIs('AWS::IAM::OIDCProvider', 0)
  })

  it('has the budget', () => {
    t.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetName: 'mcptacticus-monthly',
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: 1, Unit: 'USD' },
      },
      NotificationsWithSubscribers: [
        {
          Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 80 }),
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'test@example.com' }],
        },
        {
          Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 100 }),
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'test@example.com' }],
        },
      ],
    })
  })
})
