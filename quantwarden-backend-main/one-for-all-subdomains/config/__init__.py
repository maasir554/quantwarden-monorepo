import importlib
from config import default


class Settings(object):
    def __init__(self):
        # 获取全局变量中的配置信息
        for attr in dir(default):
            setattr(self, attr, getattr(default, attr))
        # config/setting.py and config/api.py are optional, user-supplied
        # override modules (they are gitignored and may be absent). default.py
        # above already provides every setting, so skip any that aren't present.
        setting_modules = ['config.setting', 'config.api']
        for setting_module in setting_modules:
            try:
                setting = importlib.import_module(setting_module)
            except ModuleNotFoundError:
                continue
            for attr in dir(setting):
                setattr(self, attr, getattr(setting, attr))


settings = Settings()
