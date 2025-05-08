import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import { ChevronDownRegular } from '@fluentui/react-icons';
import { IChat, IChatContext } from 'intellichat/types';
import { find } from 'lodash';
import Mousetrap from 'mousetrap';
import { IChatModelConfig, IChatProviderConfig } from 'providers/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import useChatStore from 'stores/useChatStore';
import useProviderStore from 'stores/useProviderStore';

export default function ModelCtrl({
  chat,
  ctx,
}: {
  chat: IChat;
  ctx: IChatContext;
}) {
  const { t } = useTranslation();
  const editStage = useChatStore((state) => state.editStage);
  const { getAvailableProviders, getModels } = useProviderStore();
  const providers = useMemo(() => {
    return getAvailableProviders().filter((provider) => !provider.disabled);
  }, [getAvailableProviders]);
  const [curProvider, setCurProvider] = useState<IChatProviderConfig>();
  const [curModel, setCurModel] = useState<IChatModelConfig>();
  const [models, setModels] = useState<IChatModelConfig[]>([]);
  const isChanged = useRef(false);

  const [menuModelOpen, setMenuModelOpen] = useState(false);
  const [menuProviderOpen, setMenuProviderOpen] = useState(false);

  const loadModels = useCallback(
    async (provider: IChatProviderConfig) => {
      const $models = await getModels(provider);
      setModels($models);
      const defaultModel = find($models, { isDefault: true }) || $models[0];
      const ctxProvider = ctx.getProvider();
      const ctxModel = ctx.getModel();
      if (ctxProvider.name === provider.name) {
        const $model = find($models, { name: ctxModel.name });
        if ($model) {
          setCurModel($model);
          return;
        }
      }
      setCurModel(defaultModel);
    },
    [chat.id, chat.provider, chat.model],
  );

  useEffect(() => {
    isChanged.current = false;
    const ctxProvider = ctx.getProvider();
    setCurProvider(ctxProvider);
    setCurModel(ctx.getModel());
    loadModels(ctxProvider);
    return () => {
      setCurProvider(undefined);
      setCurModel(undefined);
      setModels([]);
    };
  }, [chat.id, chat.provider, chat.model]);

  useEffect(() => {
    if (curProvider) {
      loadModels(curProvider);
    } else {
      setModels([]);
    }
  }, [curProvider?.name]);

  const onModelChange = async () => {
    if (isChanged.current) {
      await editStage(chat.id, {
        provider: curProvider?.name,
        model: curModel?.name,
      });
      isChanged.current = false;
    }
  };

  useEffect(() => {
    onModelChange();
  }, [curModel?.name]);

  useEffect(() => {
    Mousetrap.bind('mod+shift+0', () => {
      setMenuModelOpen(false);
      setMenuProviderOpen(true);
    });
    return () => {
      Mousetrap.unbind('mod+shift+0');
    };
  }, [menuProviderOpen]);

  useEffect(() => {
    Mousetrap.bind('mod+shift+1', () => {
      setMenuProviderOpen(false);
      setMenuModelOpen(true);
    });
    return () => {
      Mousetrap.unbind('mod+shift+1');
    };
  }, [menuModelOpen]);

  return (
    <div className="flex flex-start items-center -ml-1.5">
      <Menu
        open={menuProviderOpen}
        onOpenChange={(_, data) => setMenuProviderOpen(data.open)}
      >
        <MenuTrigger disableButtonEnhancement>
          <Button
            title={`${t('Common.Provider')}(Mod+Shift+0)`}
            size="small"
            appearance="transparent"
            iconPosition="after"
            className="justify-start focus-visible:ring-0 focus:right-0 border-none"
            style={{
              padding: '0 4px',
              border: 0,
              boxShadow: 'none',
              minWidth: '8px',
            }}
            icon={
              <ChevronDownRegular
                className="w-3"
                style={{ marginBottom: -2 }}
              />
            }
          >
            {curProvider?.name}
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {providers.map((provider) => (
              <MenuItem
                key={provider.name}
                style={{
                  fontSize: 12,
                  paddingTop: 2,
                  paddingBottom: 2,
                  minHeight: 12,
                }}
                disabled={!provider.isReady}
                onClick={() => {
                  isChanged.current = true;
                  setCurProvider(provider);
                }}
              >
                <div className="flex justify-start items-center gap-1 text-sm py-0.5">
                  <span>{provider.name}</span>
                  {curProvider?.name === provider.name && <span>✓</span>}
                </div>
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
      <div className="text-gray-400">/</div>
      <Menu
        open={menuModelOpen}
        onOpenChange={(_, data) => setMenuModelOpen(data.open)}
      >
        <MenuTrigger disableButtonEnhancement>
          <Button
            title={`${t('Common.Model')}(Mod+Shift+1)`}
            style={{
              padding: '0 4px',
              border: 0,
              boxShadow: 'none',
              minWidth: '10px',
            }}
            size="small"
            appearance="transparent"
            iconPosition="after"
            icon={<ChevronDownRegular className="w-3" />}
            className="flex justify-start items-center"
          >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap max-w-32 sm:max-w-48">
              {curModel?.label || curModel?.name}
            </div>
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {models.length > 0 ? (
              models.map((model: IChatModelConfig) => (
                <MenuItem
                  key={model.name}
                  disabled={!model.isReady}
                  style={{
                    paddingTop: 2,
                    paddingBottom: 2,
                    minHeight: 12,
                  }}
                  onClick={() => {
                    isChanged.current = true;
                    setCurModel(model);
                  }}
                >
                  <div className="flex justify-start items-center gap-1 text-sm py-1">
                    <ToolStatusIndicator model={model} withTooltip />
                    <span> {model.label || model.name}</span>
                    {curModel?.name === model.name && <span>✓</span>}
                  </div>
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>{t('Common.NoModels')}</MenuItem>
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
