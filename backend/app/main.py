"""FastAPI 入口：挂载对话路由、开发期 CORS，并在启动时初始化会话库。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.db.session_store import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """应用生命周期：启动时建表，避免首个请求才创建 SQLite。

    @param _app: FastAPI 实例（FastAPI），本函数不读取它
    @returns AsyncIterator[None]
    """
    init_db()
    yield


app = FastAPI(title="Travel Planner Agent", version="0.1.0", lifespan=lifespan)
# 仅放开 Vite 开发源，避免本地 SSE/会话接口被浏览器拦截
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_router, prefix="/api")
