import pytest
from authenticator import Authenticator

@pytest.fixture
def auth():
  return Authenticator()

def test_register_success(auth):
  auth.register("user1", "pass1")
  assert auth.users["user1"] == "pass1"

def test_register_fail_already_exists(auth):
  auth.register("user1", "pass1")
  with pytest.raises(ValueError, match="エラー: ユーザーは既に存在します。"):
    auth.register("user1", "pass2")

def test_login_success(auth):
  auth.register("user1", "pass1")
  result = auth.login("user1", "pass1")
  assert result == "ログイン成功"

def test_login_fail_wrong_user(auth):
  with pytest.raises(ValueError, match="エラー: ユーザー名またはパスワードが正しくありません。"):
    auth.login("user1", "pass1")

def test_login_fail_wrong_password(auth):
  auth.register("user1", "pass1")
  with pytest.raises(ValueError, match="エラー: ユーザー名またはパスワードが正しくありません。"):
    auth.login("user1", "pass2")
