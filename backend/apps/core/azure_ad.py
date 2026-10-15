"""
Integração corporativa com Microsoft 365 / Azure Active Directory (Microsoft Entra ID).
Suporta Microsoft Graph API para busca de usuários e validação de autenticação 365.
"""

import os
import json
import logging
import urllib.request
import urllib.parse
import urllib.error
from django.conf import settings

logger = logging.getLogger(__name__)

# Configurações do Azure AD (lidas via ambiente)
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "").strip()
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "").strip()
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "common").strip()
AZURE_REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "").strip()

# Cache temporário em memória para o token de aplicação do Graph
_graph_token_cache = {
    "token": None,
    "expires_at": 0
}

def get_azure_config():
    """Retorna o estado da configuração do Azure AD para conferência e auditoria."""
    return {
        "client_id": AZURE_CLIENT_ID[:6] + "..." + AZURE_CLIENT_ID[-4:] if len(AZURE_CLIENT_ID) > 10 else AZURE_CLIENT_ID,
        "tenant_id": AZURE_TENANT_ID,
        "is_configured": bool(AZURE_CLIENT_ID and AZURE_TENANT_ID and AZURE_TENANT_ID != "common"),
        "has_client_secret": bool(AZURE_CLIENT_SECRET),
        "redirect_uri": AZURE_REDIRECT_URI,
    }

def get_graph_access_token():
    """
    Obtém um access_token de aplicação do Microsoft Graph via Client Credentials Grant.
    Permite ao backend buscar informações de usuários no Azure AD sem interatividade.
    """
    client_id = os.getenv("AZURE_CLIENT_ID", "").strip()
    client_secret = os.getenv("AZURE_CLIENT_SECRET", "").strip()
    tenant_id = os.getenv("AZURE_TENANT_ID", "").strip()

    if not client_id or not client_secret or not tenant_id:
        logger.warning("Credenciais do Azure AD incompletas para consulta Graph (necessário CLIENT_ID, CLIENT_SECRET e TENANT_ID).")
        return None

    import time
    now = time.time()
    if _graph_token_cache["token"] and _graph_token_cache["expires_at"] > now + 60:
        return _graph_token_cache["token"]

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials"
    }).encode("utf-8")

    req = urllib.request.Request(
        token_url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            access_token = resp_data.get("access_token")
            expires_in = resp_data.get("expires_in", 3600)
            _graph_token_cache["token"] = access_token
            _graph_token_cache["expires_at"] = now + expires_in
            return access_token
    except urllib.error.HTTPError as e:
        error_content = e.read().decode("utf-8")
        logger.error(f"Erro ao obter token do Microsoft Graph: HTTP {e.code} - {error_content}")
        return None
    except Exception as e:
        logger.error(f"Falha na conexão com Microsoft Azure: {str(e)}")
        return None

def lookup_azure_user(email: str):
    """
    Busca os dados do colaborador no Azure AD através do e-mail corporativo.
    Retorna o nome completo, cargo, departamento e se a conta está ativa (accountEnabled).
    """
    email = email.strip()
    if not email:
        return {"found": False, "detail": "E-mail corporativo não informado."}

    graph_token = get_graph_access_token()
    if not graph_token:
        # Se as credenciais do Azure ainda não foram configuradas no .env, informa o admin
        client_id = os.getenv("AZURE_CLIENT_ID", "").strip()
        client_secret = os.getenv("AZURE_CLIENT_SECRET", "").strip()
        if not client_id or not client_secret:
            return {
                "found": False,
                "configured": False,
                "detail": "Credenciais AZURE_CLIENT_ID ou AZURE_CLIENT_SECRET não configuradas no arquivo .env do backend. Preencha manualmente enquanto configura as chaves do Azure."
            }
        return {
            "found": False,
            "configured": True,
            "detail": "Não foi possível conectar ao Microsoft Graph. Verifique se o Client Secret e as permissões de API (User.Read.All) estão ativas no portal Azure."
        }

    # Escapa o e-mail para a URL do Graph
    quoted_email = urllib.parse.quote(email)
    graph_url = (
        f"https://graph.microsoft.com/v1.0/users/{quoted_email}?"
        "$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,accountEnabled,mobilePhone,businessPhones"
    )

    req = urllib.request.Request(
        graph_url,
        headers={
            "Authorization": f"Bearer {graph_token}",
            "Accept": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {
                "found": True,
                "configured": True,
                "id": data.get("id"),
                "displayName": data.get("displayName", ""),
                "givenName": data.get("givenName", ""),
                "surname": data.get("surname", ""),
                "mail": data.get("mail") or data.get("userPrincipalName", email),
                "userPrincipalName": data.get("userPrincipalName", email),
                "jobTitle": data.get("jobTitle") or "",
                "department": data.get("department") or "",
                "accountEnabled": data.get("accountEnabled", True),
                "mobilePhone": data.get("mobilePhone") or (data.get("businessPhones", [""])[0] if data.get("businessPhones") else ""),
            }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {
                "found": False,
                "configured": True,
                "detail": f"O usuário com e-mail '{email}' não foi localizado no Active Directory (Azure AD)."
            }
        err_msg = e.read().decode("utf-8")
        logger.error(f"Erro Graph API ao buscar {email}: HTTP {e.code} - {err_msg}")
        return {"found": False, "configured": True, "detail": f"Erro na consulta do Azure AD (HTTP {e.code})."}
    except Exception as e:
        logger.error(f"Exceção ao consultar usuário no Azure AD: {str(e)}")
        return {"found": False, "configured": True, "detail": f"Falha de rede ao consultar Azure AD: {str(e)}"}

def verify_azure_user_status(email_or_upn: str) -> dict:
    """
    Verifica se o usuário existe no Azure AD e se está com accountEnabled == True.
    Retorna {'account_enabled': True/False, 'exists': True/False}
    """
    info = lookup_azure_user(email_or_upn)
    if not info.get("found"):
        return {"exists": False, "account_enabled": False}
    return {
        "exists": True,
        "account_enabled": bool(info.get("accountEnabled", True)),
        "data": info
    }

def validate_user_access_token_with_graph(access_token: str):
    """
    Valida um access_token do usuário autenticado no frontend/mobile chamando https://graph.microsoft.com/v1.0/me.
    Garante autenticidade e traz os dados oficiais do colaborador no Microsoft 365.
    """
    req = urllib.request.Request(
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,accountEnabled",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            email = data.get("mail") or data.get("userPrincipalName", "")
            return {
                "valid": True,
                "email": email.strip().lower(),
                "displayName": data.get("displayName", ""),
                "givenName": data.get("givenName", ""),
                "surname": data.get("surname", ""),
                "ad_oid": data.get("id", ""),
                "jobTitle": data.get("jobTitle", ""),
                "department": data.get("department", ""),
                "accountEnabled": data.get("accountEnabled", True),
            }
    except urllib.error.HTTPError as e:
        logger.warning(f"Access token Microsoft inválido ou expirado: HTTP {e.code}")
        return {"valid": False, "error": f"Token Microsoft 365 inválido ou expirado (HTTP {e.code})."}
    except Exception as e:
        logger.error(f"Erro ao validar token com Graph /me: {str(e)}")
        return {"valid": False, "error": f"Falha ao contatar Microsoft Graph: {str(e)}"}
