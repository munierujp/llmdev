import os
from dotenv import load_dotenv
import tiktoken
from langchain_community.document_loaders import DirectoryLoader
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.tools.retriever import create_retriever_tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
import markdown as md
import bleach
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.tools.tavily_search import TavilySearchResults
from typing import Annotated
from typing_extensions import TypedDict

MODEL_NAME = "gpt-4o-mini" 

load_dotenv(".env")
os.environ['OPENAI_API_KEY'] = os.environ['API_KEY']
memory = MemorySaver()
graph = None

class State(TypedDict):
  """メッセージのリストを保持する辞書型"""
  messages: Annotated[list, add_messages]

def create_index(persist_directory, embedding_model):
  current_script_path = os.path.abspath(__file__)
  current_directory = os.path.dirname(current_script_path)
  loader = DirectoryLoader(f'{current_directory}/data/pdf', glob="./*.pdf",   loader_cls=PyPDFLoader)
  documents = loader.load()
  encoding_name = tiktoken.encoding_for_model(MODEL_NAME).name
  text_splitter = CharacterTextSplitter.from_tiktoken_encoder(encoding_name)
  texts = text_splitter.split_documents(documents)
  db = Chroma.from_documents(texts, embedding_model, persist_directory=persist_directory)
  return db

def define_tools():
  current_script_path = os.path.abspath(__file__)
  current_directory = os.path.dirname(current_script_path)
  persist_directory = f'{current_directory}/chroma_db'
  embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

  if os.path.exists(persist_directory):
    try:
      db = Chroma(persist_directory=persist_directory, embedding_function=embedding_model)
      print("既存のインデックスを復元しました。")
    except Exception as e:
      print(f"インデックスの復元に失敗しました: {e}")
      db = create_index(persist_directory, embedding_model)
  else:
    print(f"インデックスを新規作成します。")
    db = create_index(persist_directory, embedding_model)

  retriever = db.as_retriever()
  retriever_tool = create_retriever_tool(
    retriever,
    "retrieve_company_rules",
    "Search and return company rules",
  )
  tavily_tool = TavilySearchResults(max_results=2)
  return [retriever_tool, tavily_tool]

def build_graph(model_name: str, memory: MemorySaver):
  """
  グラフのインスタンスを作成し、ツールノードやチャットボットノードを追加します。
  モデル名とメモリを使用して、実行可能なグラフを作成します。
  """
  graph_builder = StateGraph(State)
  tools = define_tools()
  tool_node = ToolNode(tools)
  graph_builder.add_node("tools", tool_node)
  llm = ChatOpenAI(model_name=model_name)
  llm_with_tools = llm.bind_tools(tools)
  
  def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}
  
  graph_builder.add_node("chatbot", chatbot)
  graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
  )
  graph_builder.add_edge("tools", "chatbot")
  graph_builder.set_entry_point("chatbot")
  return graph_builder.compile(checkpointer=memory)

def stream_graph_updates(graph: StateGraph, user_message: str, thread_id: str):
  """
  ユーザーからのメッセージを元に、グラフを実行し、チャットボットの応答をストリーミングします。
  """
  response = graph.invoke(
    {"messages": [("user", user_message)]},
    {"configurable": {"thread_id": thread_id}},
    stream_mode="values"
  )
  return response["messages"][-1].content

def get_bot_response(user_message: str, memory: MemorySaver, thread_id: str):
  """
  ユーザーのメッセージに基づき、ボットの応答を取得します。
  初回の場合、新しいグラフを作成します。
  """
  global graph

  if graph is None:
    graph = build_graph(MODEL_NAME, memory)

  return stream_graph_updates(graph, user_message, thread_id)

def get_messages_list(memory: MemorySaver, thread_id: str):
  """
  メモリからメッセージ一覧を取得し、ユーザーとボットのメッセージを分類します。
  """
  messages = []
  memories = memory.get({"configurable": {"thread_id": thread_id}})['channel_values']['messages']

  # Markdown -> HTML 変換設定
  allowed_tags = bleach.sanitizer.ALLOWED_TAGS.union({
    'p','pre','code','blockquote','hr','br','ul','ol','li','strong','em','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','a'
  })
  allowed_attrs = {
    '*': ['class'],
    'a': ['href','title','rel','target'],
    'img': ['src','alt','title']
  }

  def extract_text(content) -> str:
    # content が文字列ならそのまま
    if isinstance(content, str):
      return content
    # list の場合 (langchain の構造化メッセージ想定)
    if isinstance(content, list):
      parts = []
      for c in content:
        if isinstance(c, str):
          parts.append(c)
        elif isinstance(c, dict):
          # text / content / tool_output など汎用的に拾う
          for key in ('text','content','output','tool_output'):  # 優先順
            if key in c and isinstance(c[key], str):
              parts.append(c[key])
              break
      return '\n'.join(parts)
    # dict 単体
    if isinstance(content, dict):
      for key in ('text','content','output','tool_output'):
        if key in content and isinstance(content[key], str):
          return content[key]
    return str(content)

  def render_markdown(raw) -> str:
    text = extract_text(raw)
    html = md.markdown(
      text,
      extensions=['fenced_code', 'tables', 'toc', 'sane_lists']
    )
    clean = bleach.clean(html, tags=allowed_tags, attributes=allowed_attrs, strip=True)
    return clean

  for message in memories:
    if isinstance(message, HumanMessage):
      messages.append({'class': 'user-message', 'text': render_markdown(message.content)})
    elif isinstance(message, AIMessage) and message.content:
      messages.append({'class': 'bot-message', 'text': render_markdown(message.content)})
  
  return messages