from .sources import SearchQuery

DEFAULT_QUERIES = (
    SearchQuery("systems administrator"),
    SearchQuery("support engineer"),
    SearchQuery("helpdesk"),
    SearchQuery("level 3 support"),
    SearchQuery("level 2 support"),
    SearchQuery("level 1 support"),
    SearchQuery("infrastructure engineer"),
    SearchQuery("cloud engineer"),
    SearchQuery("devops engineer"),
    SearchQuery("service desk analyst"),
    SearchQuery("microsoft 365"),
    SearchQuery("azure"),
    SearchQuery("casual work", stream="bridge"),
    SearchQuery("warehouse", stream="bridge"),
    SearchQuery("traineeship", stream="traineeship"),
    SearchQuery("data centre technician", stream="traineeship"),
    SearchQuery("cabling technician", stream="traineeship"),
)
