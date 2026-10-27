import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AuthLayout from '../src/app/auth/layout';
import AuthErrorPage from '../src/app/auth/error/page';
import { LoginView } from '../src/features/authentication/login-view';
import { ChangePasswordView } from '../src/features/authentication/change-password-view';

const meta = {
  title: 'Authentication/Pages',
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div className="-m-6">
        <AuthLayout>
          <Story />
        </AuthLayout>
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = { render: () => <LoginView preview={false} /> };
export const PasswordChanged: Story = {
  render: () => <LoginView preview={false} passwordChanged />,
};
export const TemporaryPassword: Story = {
  render: () => <ChangePasswordView email="person@example.test" mustChangePassword />,
};
export const ChangePassword: Story = {
  render: () => <ChangePasswordView email="person@example.test" mustChangePassword={false} />,
};

export const SignInError: Story = { render: () => <AuthErrorPage /> };
